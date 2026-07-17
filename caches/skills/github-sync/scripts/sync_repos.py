#!/usr/bin/env python3
"""
github-sync: Discover every local Git repo and sync it with its GitHub remote.

- Remote newer  → git pull --rebase
- Local newer   → git add -A, descriptive commit, git push
- Diverged      → smart merge (prefer longer/newer hunk), then push
- No upstream   → warn and skip
"""

import argparse
import datetime
import os
import subprocess
import sys
from pathlib import Path

# ── ANSI colours ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

SKIP_DIRS = {
    "node_modules", ".cache", ".npm", ".yarn", "vendor",
    "__pycache__", ".venv", "venv", ".tox", "dist", "build",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def run(cmd: list[str], cwd: str, capture=True, input_text=None) -> tuple[int, str, str]:
    """Run a command, return (returncode, stdout, stderr)."""
    result = subprocess.run(
        cmd, cwd=cwd, text=True,
        capture_output=capture,
        input=input_text,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def log(label: str, msg: str, colour=RESET):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"{colour}{BOLD}[{ts}] {label}{RESET} {msg}")


def discover_repos(root: Path, max_depth: int = 5) -> list[Path]:
    """Find all .git directories under root, skipping common noise dirs."""
    repos = []
    for dirpath, dirnames, _ in os.walk(root):
        # Prune skip dirs in-place so os.walk won't descend into them
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".")
        ]
        depth = dirpath.count(os.sep) - str(root).count(os.sep)
        if depth >= max_depth:
            dirnames.clear()
            continue
        if ".git" in os.listdir(dirpath):
            repos.append(Path(dirpath))
            dirnames.clear()          # don't recurse into nested repos
    return repos


# ── commit message generation ─────────────────────────────────────────────────

def _detect_prefix(diff_stat: str, file_names: list[str]) -> str:
    combined = (diff_stat + " ".join(file_names)).lower()
    if any(kw in combined for kw in ("fix", "bug", "patch", "hotfix", "error", "crash")):
        return "fix"
    if any(kw in combined for kw in ("feat", "add", "new", "creat", "introduc", "implement")):
        return "feat"
    if any(kw in combined for kw in ("refactor", "restructur", "reorganiz", "cleanup", "clean up")):
        return "refactor"
    if any(kw in combined for kw in ("doc", "readme", "changelog", "comment")):
        return "docs"
    if any(kw in combined for kw in ("test", "spec", "jest", "pytest")):
        return "test"
    return "chore"


def build_commit_message(repo_path: str) -> str:
    _, stat_out, _ = run(["git", "diff", "--cached", "--stat"], repo_path)
    _, names_out, _ = run(["git", "diff", "--cached", "--name-only"], repo_path)
    files = [f for f in names_out.splitlines() if f]

    if not files:
        # Nothing staged — shouldn't happen, but be safe
        return f"chore: auto-sync {datetime.date.today()}"

    extensions = sorted({f.rsplit(".", 1)[-1] for f in files if "." in f})
    top_dirs   = sorted({f.split("/")[0] for f in files if "/" in f} or {"."})

    scope    = ", ".join(top_dirs[:3]) + ("…" if len(top_dirs) > 3 else "")
    ext_str  = "/".join(extensions[:4]) if extensions else "misc"
    n        = len(files)
    ts       = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    prefix   = _detect_prefix(stat_out, files)

    subject = f"{prefix}: sync {n} file(s) [{ext_str}] in {scope} — auto-sync {ts}"

    # Body: the diff stat is a good human-readable summary
    body = stat_out if stat_out else "(no stat available)"
    return f"{subject}\n\n{body}"


# ── conflict resolution ───────────────────────────────────────────────────────

def _resolve_conflict_file(filepath: str, repo_path: str) -> bool:
    """
    Try to auto-resolve a conflicted file by choosing the longer (more complete) hunk.
    Returns True if resolved, False if it couldn't be handled automatically.
    """
    full = os.path.join(repo_path, filepath)
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
    except OSError:
        return False  # binary or unreadable — skip

    if "<<<<<<< " not in content:
        return True   # no conflict markers — already fine

    lines = content.splitlines(keepends=True)
    resolved = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("<<<<<<< "):
            # Collect ours vs theirs
            ours, theirs = [], []
            i += 1
            section = "ours"
            while i < len(lines):
                l = lines[i]
                if l.startswith("======="):
                    section = "theirs"
                elif l.startswith(">>>>>>> "):
                    break
                elif section == "ours":
                    ours.append(l)
                else:
                    theirs.append(l)
                i += 1
            # Pick the longer (more complete) side; tie → prefer theirs (remote/newer intent)
            chosen = ours if len("".join(ours)) > len("".join(theirs)) else theirs
            resolved.extend(chosen)
        else:
            resolved.append(line)
        i += 1

    # Verify we removed all conflict markers
    resolved_text = "".join(resolved)
    if "<<<<<<< " in resolved_text or ">>>>>>> " in resolved_text:
        return False  # something went wrong

    with open(full, "w", encoding="utf-8") as fh:
        fh.write(resolved_text)
    return True


def auto_resolve_conflicts(repo_path: str) -> bool:
    """Attempt to resolve all conflicted files. Returns True if all resolved."""
    _, out, _ = run(["git", "diff", "--name-only", "--diff-filter=U"], repo_path)
    conflicted = [f for f in out.splitlines() if f]
    if not conflicted:
        return True

    all_ok = True
    for filepath in conflicted:
        ok = _resolve_conflict_file(filepath, repo_path)
        if ok:
            run(["git", "add", filepath], repo_path)
            log("  resolve", f"✓ {filepath}", GREEN)
        else:
            log("  resolve", f"✗ cannot auto-resolve {filepath} (binary/complex)", RED)
            all_ok = False
    return all_ok


# ── per-repo sync ─────────────────────────────────────────────────────────────

def sync_repo(repo: Path) -> str:
    """Sync one repo. Returns a one-line status summary."""
    name = repo.name
    path = str(repo)

    # 1. Fetch
    rc, _, err = run(["git", "fetch", "origin"], path)
    if rc != 0:
        log(name, f"fetch failed: {err}", RED)
        return f"FAIL  {name}: fetch error"

    # 2. Compare
    _, local,  _ = run(["git", "rev-parse", "@"],    path)
    _, remote, _ = run(["git", "rev-parse", "@{u}"], path)
    _, base,   _ = run(["git", "merge-base", "@", "@{u}"], path)

    if not remote:
        log(name, "no upstream branch — skipping", YELLOW)
        return f"SKIP  {name}: no upstream"

    if local == remote:
        log(name, "already in sync", CYAN)
        return f"SYNC  {name}: up-to-date"

    branch_rc, branch, _ = run(["git", "branch", "--show-current"], path)
    branch = branch or "main"

    # 3. Pull
    if local == base:
        log(name, "pulling remote changes…", CYAN)
        rc, out, err = run(["git", "pull", "--rebase", "origin", branch], path)
        if rc != 0:
            # Rebase conflict — try merge fallback
            run(["git", "rebase", "--abort"], path)
            log(name, "rebase conflict — attempting merge…", YELLOW)
            rc, out, err = run(["git", "merge", "origin/" + branch], path)
            if rc != 0:
                if not auto_resolve_conflicts(path):
                    run(["git", "merge", "--abort"], path)
                    log(name, "unresolvable conflict — skipped", RED)
                    return f"FAIL  {name}: unresolvable conflict"
                merge_msg = f"merge: resolve conflicts — kept best/newest code (auto-sync {datetime.date.today()})"
                run(["git", "commit", "-m", merge_msg], path)
                run(["git", "push", "origin", branch], path)
                return f"MERGE {name}: conflicts resolved and pushed"
        log(name, "pulled ✓", GREEN)
        return f"PULL  {name}: updated from remote"

    # 4. Push
    if remote == base:
        log(name, "staging and committing local changes…", CYAN)
        # Stage all
        run(["git", "add", "-A"], path)
        _, staged, _ = run(["git", "diff", "--cached", "--name-only"], path)
        if not staged.strip():
            log(name, "nothing to commit after staging", YELLOW)
            return f"SKIP  {name}: nothing to commit"
        msg = build_commit_message(path)
        run(["git", "commit", "-m", msg], path)
        rc, out, err = run(["git", "push", "origin", branch], path)
        if rc != 0:
            log(name, f"push failed: {err}", RED)
            return f"FAIL  {name}: push error"
        log(name, "committed and pushed ✓", GREEN)
        return f"PUSH  {name}: local changes committed & pushed"

    # 5. Diverged
    log(name, "diverged — merging…", YELLOW)
    run(["git", "add", "-A"], path)
    _, staged, _ = run(["git", "diff", "--cached", "--name-only"], path)
    if staged.strip():
        run(["git", "commit", "-m", f"chore: stage local work before merge — auto-sync {datetime.date.today()}"], path)

    rc, out, err = run(["git", "merge", "origin/" + branch], path)
    if rc != 0:
        if not auto_resolve_conflicts(path):
            run(["git", "merge", "--abort"], path)
            log(name, "unresolvable conflict — skipped", RED)
            return f"FAIL  {name}: unresolvable conflict"
        merge_msg = f"merge: resolve conflicts — kept best/newest code (auto-sync {datetime.date.today()})"
        run(["git", "commit", "-m", merge_msg], path)

    rc, _, err = run(["git", "push", "origin", branch], path)
    if rc != 0:
        log(name, f"push after merge failed: {err}", RED)
        return f"FAIL  {name}: push after merge error"

    log(name, "merged and pushed ✓", GREEN)
    return f"MERGE {name}: diverged, merged, pushed"


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sync all local Git repos with GitHub.")
    parser.add_argument("--root", default=str(Path.home()),
                        help="Root directory to search for repos (default: $HOME)")
    parser.add_argument("--max-depth", type=int, default=5,
                        help="Max directory depth to search (default: 5)")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    print(f"\n{BOLD}{CYAN}GitHub Sync — discovering repos under {root}{RESET}\n")

    repos = discover_repos(root, args.max_depth)
    if not repos:
        print(f"{YELLOW}No Git repositories found under {root}{RESET}")
        sys.exit(0)

    print(f"Found {BOLD}{len(repos)}{RESET} repositories\n" + "─" * 60)

    results = []
    for repo in repos:
        print(f"\n{BOLD}▶ {repo}{RESET}")
        summary = sync_repo(repo)
        results.append(summary)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 60)
    print(f"{BOLD}SUMMARY{RESET}")
    print("═" * 60)
    counts = {"PULL": 0, "PUSH": 0, "MERGE": 0, "SYNC": 0, "SKIP": 0, "FAIL": 0}
    for r in results:
        prefix = r.split()[0]
        counts[prefix] = counts.get(prefix, 0) + 1
        colour = GREEN if prefix in ("PULL", "PUSH", "MERGE", "SYNC") else \
                 YELLOW if prefix == "SKIP" else RED
        print(f"  {colour}{r}{RESET}")

    print("\n" + "─" * 60)
    print(f"  {GREEN}Pulled : {counts['PULL']}  "
          f"Pushed : {counts['PUSH']}  "
          f"Merged : {counts['MERGE']}  "
          f"In-sync: {counts['SYNC']}{RESET}")
    print(f"  {YELLOW}Skipped: {counts['SKIP']}{RESET}  "
          f"{RED}Failed : {counts['FAIL']}{RESET}")
    print("─" * 60 + "\n")


if __name__ == "__main__":
    main()
