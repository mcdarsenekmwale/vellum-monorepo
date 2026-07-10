#!/bin/sh
set -e

echo "============================================================"
echo "  Vellum API — Production Startup"
echo "============================================================"
echo ""

echo "[1/2] Running Prisma migrations..."
npx prisma migrate deploy
echo "Migrations applied successfully."
echo ""

echo "[2/2] Starting API server..."
echo ""

exec "$@"
