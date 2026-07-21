# Suggestion: Scope skill fan-out by platform

Fan-out now skips peers whose `SKILL.md` content hash differs, so divergent same-name skills are safe. Clones that share content still sync across all enabled platforms (e.g. `.cursor/skills` and `.codex/skills`). If multi-platform clones should stay independent even when content matches, add a “sync peers” toggle or scope fan-out to the same platform id.

Effort: small.
