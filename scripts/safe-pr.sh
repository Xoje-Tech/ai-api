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

# Auto-detect label from branch name (e.g., feat/xyz -> type:feature)
BRANCH_NAME=$(git branch --show-current)
LABEL=""
if [[ "$BRANCH_NAME" == feat/* ]]; then LABEL="type:feature"; fi
if [[ "$BRANCH_NAME" == fix/* ]]; then LABEL="type:bug"; fi
if [[ "$BRANCH_NAME" == chore/* || "$BRANCH_NAME" == ci/* || "$BRANCH_NAME" == test/* ]]; then LABEL="type:chore"; fi
if [[ "$BRANCH_NAME" == docs/* ]]; then LABEL="type:docs"; fi
if [[ "$BRANCH_NAME" == refactor/* ]]; then LABEL="type:refactor"; fi

LABEL_ARG=""
if [[ -n "$LABEL" ]]; then
  echo "🏷️  Auto-detected label: $LABEL"
  LABEL_ARG="--label $LABEL"
fi

# Pass all arguments, add reviewer (DevXoje), and dynamic label.
# Note: GitHub Apps cannot be assignees, so we skip --assignee "@me".
gh pr create "$@" --reviewer "DevXoje" $LABEL_ARG
