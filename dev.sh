#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

export DATABASE_PATH="${DATABASE_PATH:-$ROOT/munus.db}"
export APP_ENV="${APP_ENV:-development}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
export ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-Admin}"

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null
  wait "$BACKEND_PID" 2>/dev/null
}
trap cleanup EXIT

cd "$ROOT/backend"
go run . &
BACKEND_PID=$!

cd "$ROOT/frontend"
npm run dev
