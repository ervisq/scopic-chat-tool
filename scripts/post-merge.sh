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
