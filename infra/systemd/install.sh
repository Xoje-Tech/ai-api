#!/usr/bin/env bash
# Idempotent installer for the gh-token-renew systemd user timer.
# Lives at ai-api/infra/systemd/install.sh; assumes you have already
# cloned the repo and added ~/.hermes/scripts/renew-gh-token.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/gh-token-renew.service"
TIMER_FILE="$SCRIPT_DIR/gh-token-renew.timer"

USER_SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$USER_SYSTEMD_DIR"

ln -sf "$SERVICE_FILE" "$USER_SYSTEMD_DIR/gh-token-renew.service"
ln -sf "$TIMER_FILE"  "$USER_SYSTEMD_DIR/gh-token-renew.timer"

systemctl --user daemon-reload

cat <<EOF

Symlinks created in $USER_SYSTEMD_DIR/

Next steps (manual, one-time):
  systemctl --user enable --now gh-token-renew.timer
  systemctl --user list-timers gh-token-renew.timer     # verify

Logs:
  journalctl --user -u gh-token-renew.service -n 20

Uninstall:
  systemctl --user disable --now gh-token-renew.timer
  rm $USER_SYSTEMD_DIR/gh-token-renew.{service,timer}
  systemctl --user daemon-reload
EOF
