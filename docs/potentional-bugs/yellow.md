# Yellow: Hub offline

When GitHub Pages is not live, hub list falls back to cache only; install may fail for uncached items.

# Yellow: Resource name collisions

Resources are grouped by name in the table UI. Two different skills with the same folder name in different sources appear as one row; edit uses the canonical (platform-preferred) instance.

# Yellow: Hook unassign heuristic

Unassigning hooks from a project uses a name/command substring match which may remove unrelated hook entries in edge cases.
