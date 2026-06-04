---
name: Gitea auto-sync
description: How and why the project keeps Gitea in sync, and why GitHub is not the sync source.
---

# Gitea auto-sync

The repo mirrors to Gitea (`gitea.com/ervisq/scopic-chat-tool`, branch `main`) via a
best-effort push step appended to the post-merge script (`scripts/post-merge.sh`),
which Replit runs automatically after every task merge. Auth uses the `GITEA_TOKEN`
secret; the push is non-fatal (logs `[gitea-sync] WARNING` on failure) so a sync
hiccup never breaks dependency install / migrations.

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
