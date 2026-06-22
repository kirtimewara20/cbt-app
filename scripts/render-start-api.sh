#!/usr/bin/env bash
set -euo pipefail

cd apps/api

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=460}"

echo "==> Waiting for database and applying migrations..."
for attempt in 1 2 3 4 5 6 7 8; do
  if npx prisma migrate deploy; then
    echo "==> Migrations OK"
    break
  fi
  if [ "$attempt" -eq 8 ]; then
    echo "==> Migrations failed after 8 attempts — check DATABASE_URL and cbt-db status on Render"
    exit 1
  fi
  wait=$((attempt * 10))
  echo "==> Migration attempt ${attempt} failed (DB may be waking). Retrying in ${wait}s..."
  sleep "$wait"
done

echo "==> Starting API on port ${PORT:-4000}..."
exec node dist/src/main.js
