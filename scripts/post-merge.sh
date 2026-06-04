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
