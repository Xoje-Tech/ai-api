#!/usr/bin/env bash

# This script wraps 'pnpm run dev' to dynamically inject secrets from 
# Bitwarden Secrets Manager (BWS) directly into the environment, bypassing .env files.
# Requires the 'bws' CLI to be installed and authenticated.

echo "🔒 Fetching secrets from Bitwarden Secrets Manager..."

# We fetch the exact IDs of the secrets we need
OPENROUTER_SECRET=$(bws secret get "3482fc1f-6241-43a4-9de6-b46d0069fbe7" | jq -r .value)
GROQ_SECRET=$(bws secret get "55cef79c-d200-49a6-ad5e-b478013f2479" | jq -r .value)
NVIDIA_SECRET=$(bws secret get "b7b877c6-a85e-49b2-b957-b47d00799a91" | jq -r .value)

if [ -z "$OPENROUTER_SECRET" ] || [ -z "$GROQ_SECRET" ] || [ -z "$NVIDIA_SECRET" ]; then
    echo "❌ Failed to fetch one or more secrets from BWS. Make sure you are authenticated."
    exit 1
fi

echo "✅ Secrets fetched successfully."
echo "🚀 Starting development server..."

# Pass the secrets securely via the environment without writing to disk
# Also pass the necessary local AI_API_KEY for the auth middleware
export OPENROUTER_API_KEY="$OPENROUTER_SECRET"
export GROQ_API_KEY="$GROQ_SECRET"
export NVIDIA_API_KEY="$NVIDIA_SECRET"
export AI_API_KEY="51d4d376780a068f58342f49fda8cb68e3824b4d3a7fead14df50dd86a47b63a"
export AI_API_HOST="127.0.0.1"
export AI_API_ALLOW_PUBLIC="false"
export PORT="5678"

# Start the dev server
pnpm run dev
