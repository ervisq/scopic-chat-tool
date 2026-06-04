---
name: Repo mirror auto-sync (Gitea + GitHub)
description: How and why the project keeps Gitea and GitHub mirrors in sync, and why GitHub is not the sync source.
---

# Repo mirror auto-sync (Gitea + GitHub)

The repo mirrors to Gitea (`gitea.com/ervisq/scopic-chat-tool`, branch `main`) via a
best-effort push step appended to the post-merge script (`scripts/post-merge.sh`),
which Replit runs automatically after every task merge. Auth uses the `GITEA_TOKEN`
secret; the push is non-fatal (logs `[gitea-sync] WARNING` on failure) so a sync
hiccup never breaks dependency install / migrations.

The same script also pushes to GitHub (`github.com/ervisq/scopic-chat-tool`, branch
`main`) with the same best-effort, non-fatal, plain (non-force) semantics. **GitHub's
token is NOT a static secret** like Gitea's — it is the rotating OAuth token from the
connected GitHub integration, so the script fetches it at runtime instead of storing
it. Mechanism: a tiny inline `node -e` requires `@replit/connectors-sdk/identity.js`
(`resolveBaseUrl` + `buildHeaders`) and GETs
`/api/v2/connection?connector_names=github&include_secrets=true` to read
`items[0].settings.access_token`. Note the SDK's own `listConnections()` does NOT
return secrets — you must hit the endpoint with `include_secrets=true` directly. The
token is embedded only in an in-memory push URL and redacted from logs via `sed`.

**Why push from the workspace instead of a Gitea pull-mirror from GitHub:**
GitHub `origin/main` is on a *separate, divergent history* (stale — e.g. a "temp 2FA
bypass" commit), not the current code. The workspace (matching `gitsafe-backup/main`)
is the real source of truth. A pull-mirror from GitHub would mirror the wrong code, so
we push the merged `HEAD` directly to Gitea instead.

**How to apply:** If asked to "keep Gitea updated" or debug Gitea being stale, check
`scripts/post-merge.sh` sync step and the `GITEA_TOKEN` secret first. Do not switch to
a GitHub-based mirror unless GitHub's history is first reconciled with the workspace.
The push is plain (fast-forward), not `--force`, to avoid clobbering any future
Gitea-side commits; if histories diverge it fails non-fatally and needs manual attention.
