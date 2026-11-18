#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/jira-logger.service"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as your normal user, not root. It installs a systemd user service." >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found. This installer targets systemd-based Linux." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found in PATH. Install Node.js 22.23.4+ and run this again." >&2
  exit 1
fi

if [[ ! -x "$ROOT/node_modules/.bin/astro" ]]; then
  echo "Dependencies missing. Run: npm install" >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created $ROOT/.env"
fi

NODE_BIN_DIR="$(dirname "$(command -v node)")"
SERVICE_PATH="$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$UNIT_DIR"

cat > "$UNIT_PATH" <<EOF
[Unit]
Description=Jira Logger local dev server

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment="PATH=$SERVICE_PATH"
Environment="ASTRO_DEV_BACKGROUND=0"
EnvironmentFile=-$ROOT/.env
ExecStart=$ROOT/scripts/start.sh
Restart=always
RestartSec=3
KillSignal=SIGINT
TimeoutStopSec=15
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jira-logger

[Install]
WantedBy=default.target
EOF

chmod +x "$ROOT/scripts/start.sh"

systemctl --user daemon-reload
systemctl --user enable --now jira-logger.service

if command -v loginctl >/dev/null 2>&1; then
  if ! loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=yes"; then
    loginctl enable-linger "$USER" 2>/dev/null || true
  fi
fi

echo
echo "Jira Logger service installed."
echo "  Unit:   $UNIT_PATH"
echo "  Status: systemctl --user status jira-logger"
echo "  Logs:   journalctl --user -u jira-logger -f"
echo "  Stop:   systemctl --user stop jira-logger"
echo "  Start:  systemctl --user start jira-logger"
echo
echo "If the service does not start automatically at boot, run:"
echo "  sudo loginctl enable-linger $USER"
echo
echo "Default URL: http://127.0.0.1:3000"
echo "For LAN access, set HOST=0.0.0.0 in $ROOT/.env and restart the service."
