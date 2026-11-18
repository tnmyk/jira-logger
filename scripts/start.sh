#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"

# Keep Astro in the foreground so systemd can supervise the process.
export ASTRO_DEV_BACKGROUND=0

if [[ ! -x "$ROOT/node_modules/.bin/astro" ]]; then
  echo "Dependencies missing. Run: npm install" >&2
  exit 1
fi

echo "Starting Jira Logger on http://${HOST}:${PORT}"
exec "$ROOT/node_modules/.bin/astro" dev --host "$HOST" --port "$PORT"
