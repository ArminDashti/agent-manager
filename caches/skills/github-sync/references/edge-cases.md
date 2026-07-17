# Edge Cases — GitHub Sync

## Detached HEAD

If `git branch --show-current` returns empty, the repo is in detached HEAD state.
The script skips pushing (can't push without a branch) and logs a warning:

```
SKIP  <repo>: detached HEAD — checkout a branch first
```

## Repos with multiple remotes

The script always targets `origin`. If a repo has no `origin` remote but has another
(e.g., `upstream`), it logs:

```
SKIP  <repo>: no remote named 'origin'
```

To override, set `GITHUB_SYNC_REMOTE=upstream` in your environment.

## No upstream branch set

If `git rev-parse @{u}` fails, there's no tracking branch. Options:

```bash
# Set upstream for current branch
git branch --set-upstream-to=origin/<branch> <branch>
# or push and set at once
git push -u origin <branch>
```

The script warns and skips these repos rather than guessing.

## Submodules

Submodule directories contain a `.git` *file* (not directory). The discovery
walk detects them and skips them with:

```
SKIP  <repo>: submodule (managed by parent)
```

To sync submodules, run `git submodule update --remote` in the parent repo.

## Large binary files / Git LFS

If a push fails with a message mentioning LFS, the script surfaces the raw error.
Install and configure Git LFS separately:

```bash
git lfs install
git lfs track "*.psd"
```

## Protected branches (main / master)

If a push is rejected because the branch is protected, the script logs the error.
The correct fix is to open a pull request on GitHub rather than pushing directly.

## Repos with uncommitted merge in progress

If a `.git/MERGE_HEAD` file exists when the script starts, a previous merge is
unfinished. The script detects this and skips the repo:

```
SKIP  <repo>: merge in progress — resolve manually then re-run
```

## SSH vs HTTPS auth failures

Auth failures surface the raw `git push` stderr so you can diagnose:

```
FAIL  <repo>: push error — Permission denied (publickey)
```

Fix SSH: `ssh-add ~/.ssh/id_ed25519`  
Fix HTTPS: `git config --global credential.helper osxkeychain` (macOS) or `manager` (Windows)
