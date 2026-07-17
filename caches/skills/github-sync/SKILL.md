---
name: github-sync
description: >-
  Automatically sync all local Git repositories with their GitHub remotes. Use
  when the user wants to sync, update, push, pull, or keep local repos in sync
  with GitHub. Triggers on "sync my repos", "pull all repos", "push local
  changes", "sync GitHub", "update all my projects", or managing multiple local
  Git repositories against remote GitHub versions. Pulls when remote is newer,
  commits and pushes when local is newer, writes descriptive commit messages,
  and resolves merge conflicts by preferring the most complete and recent code.
---

# GitHub Sync

Syncs every local Git repository with its GitHub remote. For each repo:

- **Remote newer** → pull the latest changes
- **Local newer** → commit with a clear description + push
- **Diverged** → smart merge that favours the best/most-recent code, then push

Skill scripts live in `.cursor/skills/github-sync/scripts/` (project root).

## Quick start

```bash
# Auto-discovers repos under $HOME (or pass a root dir)
python .cursor/skills/github-sync/scripts/sync_repos.py --root ~/projects
```

On Windows PowerShell:

```powershell
python .cursor/skills/github-sync/scripts/sync_repos.py --root $env:USERPROFILE\Documents\GitHub
```

Read `scripts/sync_repos.py` for the full implementation. The sections below explain the logic so you can adapt or invoke it step by step manually.

## Step-by-step logic

### 1. Discover repositories

```bash
find "$HOME" -maxdepth 5 -name ".git" -type d 2>/dev/null | sed 's|/.git||'
```

Filter out paths inside `node_modules`, `.cache`, `/tmp`, vendor dirs, etc.

### 2. For each repo — fetch & compare

```bash
cd "$REPO"
git fetch origin 2>&1          # always fetch first — never skip

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "NO_UPSTREAM")
BASE=$(git merge-base @ @{u}  2>/dev/null || echo "NO_BASE")
```

| Condition | Action |
|---|---|
| `LOCAL == REMOTE` | Already in sync — skip |
| `REMOTE == NO_UPSTREAM` | Local-only repo — skip (warn user) |
| `LOCAL == BASE` | Remote is ahead → **Pull** |
| `REMOTE == BASE` | Local is ahead → **Commit + Push** |
| Neither | Diverged → **Merge**, then push |

### 3. Pull (remote newer)

```bash
git pull --rebase origin "$(git branch --show-current)"
```

Use `--rebase` to keep history linear. If rebase conflicts arise, fall back to the merge strategy in §5.

### 4. Commit + Push (local newer)

Generate a clear, descriptive commit message automatically:

```bash
# Collect changed files
CHANGED=$(git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)

# Stage everything
git add -A

# Build a commit message
python3 -c "
import subprocess, datetime
status = subprocess.check_output(['git','diff','--cached','--stat'], text=True).strip()
files  = subprocess.check_output(['git','diff','--cached','--name-only'], text=True).strip().split()
ts     = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
# Summarise by extension / directory
dirs   = sorted({f.split('/')[0] for f in files if '/' in f} or {'root'})
exts   = sorted({f.rsplit('.',1)[-1] for f in files if '.' in f})
scope  = ', '.join(dirs[:3]) + ('...' if len(dirs)>3 else '')
kinds  = '/'.join(exts[:4])
n      = len(files)
msg    = f'chore: sync {n} file(s) [{kinds}] in {scope} — auto-sync {ts}'
print(msg)
print()
print(status)
" | git commit -F -
```

Then push:

```bash
git push origin "$(git branch --show-current)"
```

### 5. Merge conflicts — smart resolution

When both sides have changed the same file, the script uses this priority order:

1. **Non-conflicted files** — accepted as-is.
2. **Conflicted files** — use `git diff3` to inspect both sides.
   - Choose the **longer / more-complete** version of each conflicted hunk as the base.
   - Apply the **more recent** timestamp wins as a tie-breaker (check `git log --format=%ct` on each side).
3. After auto-resolution, stage and commit with a clear merge message:

```bash
git commit -m "merge: resolve conflicts — kept best/newest code (auto-sync $(date +%Y-%m-%d))"
```

4. Push.

If auto-resolution is impossible (binary files, complex 3-way), the script **skips that repo**, prints a clear warning, and continues with the rest.

## Commit message conventions

| Situation | Prefix | Example |
|---|---|---|
| Pushing local work | `chore:` | `chore: sync 4 files [py/md] in src — auto-sync 2025-05-30 14:22` |
| Merge resolution | `merge:` | `merge: resolve conflicts — kept best/newest code (auto-sync 2025-05-30)` |
| Major feature detected | `feat:` | `feat: add authentication module — auto-sync 2025-05-30` |
| Bug fix file names | `fix:` | `fix: patch 2 files [py] in utils — auto-sync 2025-05-30` |

The script inspects file names / git diff output to pick the right prefix automatically.

## Authentication

The script assumes SSH key or HTTPS credential helper is already configured. It will warn and skip any repo where `git push` fails due to auth errors, printing the exact error so the user can fix credentials.

To check auth before running:

```bash
ssh -T git@github.com 2>&1 | grep -q "successfully authenticated" && echo "SSH OK" || echo "SSH NOT configured"
```

## Reference

See [references/edge-cases.md](references/edge-cases.md) for handling:

- Detached HEAD state
- Repos with multiple remotes
- Repos with no upstream branch set
- Submodules
- Large binary files / LFS
