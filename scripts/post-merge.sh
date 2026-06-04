#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run migrate:roles

# Apply hand-written SQL migrations idempotently (in lexicographic order).
if [ -d lib/db/migrations ] && [ -n "$DATABASE_URL" ]; then
  for f in lib/db/migrations/*.sql; do
    [ -e "$f" ] || continue
    echo "Applying migration: $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
fi

pnpm --filter db push

# Keep Gitea (https://gitea.com/ervisq/scopic-chat-tool, branch `main`) in sync with
# the latest merged code. Runs automatically after every task merge.
# Best-effort: a push failure (e.g. transient network, or a diverged Gitea history)
# is logged but does NOT fail post-merge setup. The token is redacted from output.
sync_gitea() {
  if [ -z "$GITEA_TOKEN" ]; then
    echo "[gitea-sync] GITEA_TOKEN not set; skipping Gitea sync."
    return 0
  fi
  local url="https://ervisq:${GITEA_TOKEN}@gitea.com/ervisq/scopic-chat-tool.git"
  echo "[gitea-sync] Pushing HEAD -> gitea main ..."
  if git push "$url" HEAD:main 2>&1 | sed -E "s/${GITEA_TOKEN}/***REDACTED***/g"; then
    echo "[gitea-sync] Gitea updated successfully."
  else
    echo "[gitea-sync] WARNING: push to Gitea failed (non-fatal). Gitea may be out of date or its history diverged."
  fi
  return 0
}
sync_gitea

# Keep GitHub (https://github.com/ervisq/scopic-chat-tool, branch `main`) in sync with
# the latest merged code. Runs automatically after every task merge, mirroring sync_gitea.
# The GitHub token is fetched at runtime from the connected GitHub integration (it is an
# OAuth token that rotates), so it is NEVER written to disk and is redacted from output.
# Best-effort: a missing token or a push failure (e.g. transient network, or a diverged
# GitHub history) is logged but does NOT fail post-merge setup.
sync_github() {
  local token
  token="$(node -e '
    (async () => {
      try {
        const id = require("@replit/connectors-sdk/identity.js");
        const baseUrl = id.resolveBaseUrl();
        const headers = await id.buildHeaders();
        const url = baseUrl + "/api/v2/connection?connector_names=github&include_secrets=true";
        const r = await fetch(url, { headers });
        if (!r.ok) return;
        const d = await r.json();
        const t = d && d.items && d.items[0] && d.items[0].settings && d.items[0].settings.access_token;
        if (t) process.stdout.write(t);
      } catch (e) {}
    })();
  ' 2>/dev/null)"
  if [ -z "$token" ]; then
    echo "[github-sync] No GitHub token available; skipping GitHub sync."
    return 0
  fi
  local url="https://x-access-token:${token}@github.com/ervisq/scopic-chat-tool.git"
  echo "[github-sync] Pushing HEAD -> github main ..."
  if git push "$url" HEAD:main 2>&1 | sed -E "s/${token}/***REDACTED***/g"; then
    echo "[github-sync] GitHub updated successfully."
  else
    echo "[github-sync] WARNING: push to GitHub failed (non-fatal). GitHub may be out of date or its history diverged."
  fi
  return 0
}
sync_github
