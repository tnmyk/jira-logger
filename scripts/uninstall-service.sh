#!/usr/bin/env bash
set -euo pipefail

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

systemctl --user disable --now jira-logger.service 2>/dev/null || true
rm -f "$UNIT_DIR/jira-logger.service"
systemctl --user daemon-reload
echo "Jira Logger service removed. .env and application data were kept."
