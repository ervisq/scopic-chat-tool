---
name: Graph path-segment encoding
description: Why Microsoft Graph IDs must be URL-encoded before being placed into client.api() paths in the api-server.
---

# Encode opaque Graph IDs into single path segments

When building a Microsoft Graph request path in `artifacts/api-server` (e.g.
`client.api(`/users/${user}/messages/${id}`)`), always wrap any opaque,
user/external-supplied id with `encodeURIComponent(...)`.

**Why:** Graph message ids are opaque and routinely contain reserved characters
(`/`, `+`, `=`). The `@microsoft/microsoft-graph-client` SDK does NOT URL-encode
the path you pass to `.api()`, so a raw id with `/` either segments the path
(breaking lookups for legitimate ids) or, with crafted input like `../`, becomes
a path-injection / traversal sink into other Graph resources. This was a serious
finding in the Task #148 object-detail feature.

**How to apply:** Encode each dynamic path segment at the point of interpolation
in the service layer (not just the route). Pair it with a cheap defensive guard
at the route (reject control chars, `..`, implausible length) for defense in
depth. Endpoints that accept ids with reserved chars should take them via query
param (encoded by the client) rather than a path param, to avoid proxy `%2F`
issues — then re-encode for the Graph path inside the service.
