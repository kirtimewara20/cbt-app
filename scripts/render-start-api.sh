#!/usr/bin/env bash
set -euo pipefail

echo "==> Running database migrations..."
cd apps/api
npx prisma migrate deploy

echo "==> Starting API..."
exec node dist/main.js
