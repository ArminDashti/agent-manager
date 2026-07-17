# Suggestion: Skill sync across platforms may over-copy

Skill fan-out copies a changed skill folder to every other project/platform path that already has `SKILL.md` for that name. If the same skill exists under both `.cursor/skills` and `.codex/skills` in one project, an edit in Cursor will overwrite the Codex copy (and vice versa). Consider scoping fan-out to the same platform id, or offering a “sync peers” toggle, if multi-platform skill divergence becomes common.

Effort: small.
