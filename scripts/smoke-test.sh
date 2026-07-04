#!/bin/bash
set -e

PORT=${PORT:-5678}
HOST=${AI_API_HOST:-127.0.0.1}
BASE_URL="http://$HOST:$PORT"

echo "🔥 Running live smoke test against $BASE_URL"

echo "1. Checking /health endpoint..."
HEALTH_RES=$(curl -s "$BASE_URL/health")
if echo "$HEALTH_RES" | grep -q '"status":"ok"'; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed. Response: $HEALTH_RES"
  exit 1
fi

echo "2. Checking /chat endpoint (streaming)..."
CHAT_RES=$(curl -sN -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "hola, respondeme estrictamente con la palabra ok"}]}')

if [ -n "$CHAT_RES" ]; then
  echo "   ✅ Chat streaming works. Response: $CHAT_RES"
else
  echo "   ❌ Chat check failed: Empty response"
  exit 1
fi

echo "🎉 All smoke tests passed successfully!"
