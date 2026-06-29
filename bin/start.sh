#!/usr/bin/env bash
# ===========================================================================
# start.sh — ai-api launcher with Bitwarden Secrets Manager integration
#
# Loads secrets from BWS (if available), exports them to the environment,
# and starts the server. The application reads from process.env only.
#
# Usage:
#   ./bin/start.sh              # dev mode (pnpm dev)
#   ./bin/start.sh --prod       # production mode (pnpm start)
#   ./bin/start.sh -- <args>    # passthrough to pnpm
#
# Deployment: in environments without BWS, just set OPENROUTER_API_KEY,
# GROQ_API_KEY, etc. directly and skip this wrapper.
# ===========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ---- Config ---------------------------------------------------------------
BWS_PROJECT_ID="169abe1a-315b-4abf-9684-b46d0064c6d2"
BWS_SERVER_URL="${BWS_SERVER_URL:-https://vault.bitwarden.eu}"

# ---- BWS secret loader ---------------------------------------------------
load_bws_secrets() {
  # Resolve the access token: env var first, GPG fallback
  local token="${BWS_ACCESS_TOKEN:-}"
  if [[ -z "$token" && -f "$HOME/.hermes/credentials/bws_token.gpg" ]]; then
    token="$(gpg --quiet --yes --decrypt "$HOME/.hermes/credentials/bws_token.gpg" 2>/dev/null || true)"
  fi

  if [[ -z "$token" ]]; then
    echo "[start.sh] ⚠  BWS_ACCESS_TOKEN not found — skipping BWS" >&2
    return 1
  fi

  local json
  json="$(BWS_ACCESS_TOKEN="$token" BWS_SERVER_URL="$BWS_SERVER_URL" \
    bws secret list "$BWS_PROJECT_ID" --output json 2>/dev/null)" || {
    echo "[start.sh] ⚠  bws secret list failed (token expired? network?)" >&2
    return 1
  }

  # Parse JSON with Python, export each secret, and log the keys loaded.
  # Python handles multi-line values (e.g. PEM keys) via shlex.quote.
  local env_export
  env_export="$(python3 -c "
import json, os, sys, shlex
secrets = json.load(sys.stdin)
for s in secrets:
    key = s.get('key', '')
    val = s.get('value', '')
    if key and val and key.isidentifier() and (key not in os.environ or not os.environ[key]):
        print(f'export {key}={shlex.quote(val)}')
        print(f'[start.sh] ✓ {key} loaded from BWS', file=sys.stderr)
" <<< "$json")" || return 1

  eval "$env_export"
}

# ---- Main -----------------------------------------------------------------
mode="${1:-dev}"
shift 2>/dev/null || true

load_bws_secrets || true  # non-fatal: fail open if BWS unavailable

echo "[start.sh] 🚀 Starting ai-api ($mode)" >&2

case "$mode" in
  --prod)
    exec pnpm start "$@"
    ;;
  dev|--dev)
    exec pnpm dev "$@"
    ;;
  *)
    exec pnpm "$mode" "$@"
    ;;
esac
