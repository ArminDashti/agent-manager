# Suggestion: Cache scan results for resource:stats

`resource:stats` still runs a full filesystem `scanAll` on every list load. With MCP probing removed that is usually tens of ms, but with many projects it will grow. Prefer a short-TTL scan cache (or derive summaries from the in-memory store scan) so list pages avoid redundant disk walks.

Effort: small–medium.
