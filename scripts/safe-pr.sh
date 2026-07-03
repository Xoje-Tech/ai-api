#!/bin/bash
# scripts/safe-pr.sh - Validates CI locally using 'act' before creating a PR via 'gh'
# Usage: pnpm run pr:create -- --title "My Title" --body "My Body"

set -e

echo "============================================================"
echo "🛡️  Safe PR: Running local CI validation before opening PR..."
echo "============================================================"

# Ensure DOCKER_HOST is set for rootless Podman (CachyOS/Arch compatibility)
if [ -z "$DOCKER_HOST" ]; then
  export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
fi

# Run 'act' for the pull_request event using the standard Ubuntu runner
if ! act pull_request -W .github/workflows/ci.yml --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest; then
  echo ""
  echo "❌========================================================❌"
  echo "   LOCAL CI FAILED. Pull Request creation aborted."
  echo "   Please fix the errors above and try again."
  echo "   This saved you a broken CI run on GitHub!"
  echo "❌========================================================❌"
  exit 1
fi

echo ""
echo "✅========================================================✅"
echo "   LOCAL CI PASSED. Proceeding to create Pull Request..."
echo "✅========================================================✅"

# Pass all arguments passed to this script directly to 'gh pr create'
gh pr create "$@"
