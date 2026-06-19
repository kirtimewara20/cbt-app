#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile

echo "==> Building API..."
pnpm --filter @cbt/shared build
pnpm --filter @cbt/api prisma:generate
pnpm --filter @cbt/api build

echo "==> API build complete"
