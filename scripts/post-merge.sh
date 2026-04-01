#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run migrate:roles
pnpm --filter db push
