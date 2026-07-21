# Yellow: Hub offline

When GitHub Pages is not live, hub list falls back to cache only; install may fail for uncached items.

# Yellow: Non-skill resource name collisions

Rules/hooks/subAgents/tools are still grouped by name in the table UI. Two different resources with the same display name in different sources appear as one row; edit uses the canonical (project-preferred) instance. Skills are excluded: they group by `name::contentHash`.

# Yellow: Hook unassign heuristic

Unassigning hooks from a project uses a name/command substring match which may remove unrelated hook entries in edge cases.

# Yellow: Skill sync clone races

Skill fan-out only updates same-name peers that still match the pre-edit `SKILL.md` hash. Concurrent edits to two true clones can still race; the last finished copy wins among that clone set. Divergent same-name skills are not overwritten. Reentrancy only suppresses echo from the app’s own fan-out writes.

# Yellow: Platform sync on startup

`syncEnabledPlatformsToProjects` re-copies every project-assigned resource into all enabled platforms on each app start. Large project sets can slow startup; copies are idempotent but still hit the disk. Assign of a skill into a project that already has a different-content same-name skill fails with an error (unique-skill guard).
