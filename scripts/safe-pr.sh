#!/bin/bash
# scripts/safe-pr.sh - Validates CI locally using 'act' before creating a PR via 'gh'
# Usage: pnpm run pr:create -- --base develop --title "My Title" --body "My Body"

set -e

echo "============================================================"
echo "🛡️  Safe PR: Running local CI validation before opening PR..."
echo "============================================================"

# 1. Extract the base branch from arguments (default to develop)
BASE_BRANCH="develop"
prev=""
for arg in "$@"; do
  if [[ "$prev" == "--base" || "$prev" == "-B" ]]; then
    BASE_BRANCH="$arg"
  fi
  prev="$arg"
done

echo "🔍 Analyzing diff against origin/$BASE_BRANCH..."
git fetch origin "$BASE_BRANCH" --quiet || true

# 2. Check if there are any non-docs changes
# grep -qvE returns 0 (true) if it finds a file that DOES NOT match .md, .txt, or docs folders
if git diff --name-only "origin/$BASE_BRANCH...HEAD" | grep -qvE '\.(md|txt)$|^openspec/|^\.knowledge/'; then
  echo "⚙️  Code changes detected. Running full local CI (act)..."
  
  if [ -z "$DOCKER_HOST" ]; then
    export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
  fi

  if ! act pull_request -W .github/workflows/ci.yml --container-architecture linux/amd64 -P ubuntu-latest=catthehacker/ubuntu:act-latest; then
    echo ""
    echo "❌========================================================❌"
    echo "   LOCAL CI FAILED. Pull Request creation aborted."
    echo "   Please fix the errors above and try again."
    echo "   This saved you a broken CI run on GitHub!"
    echo "❌========================================================❌"
    exit 1
  fi
else
  echo "📝 Docs-only change detected! Bypassing heavy Docker CI..."
  echo "⚡ Running fast knowledge lint instead..."
  if pnpm run | grep -q "knowledge:lint"; then
    pnpm knowledge:lint || { echo "❌ Knowledge lint failed!"; exit 1; }
  fi
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

gh pr create "$@" --reviewer "DevXoje" $LABEL_ARG