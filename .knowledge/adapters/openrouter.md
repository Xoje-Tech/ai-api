---
type: Provider Profile
title: OpenRouter
description: Unified API for multiple LLMs. We target their ":free" model variants as a load-balancing fallback.
resource_url: https://openrouter.ai/docs/api/reference/limits
tags: [provider, free-tier, openrouter, llm, ai-balancer, aggregator]
timestamp: 2026-07-04T12:00:00Z
provider_config:
  tier_status: "free"
  usage_limits:
    rpm: 20
    rpd: 50
    tpm: 10000
    tpd: 100000
    concurrent_requests: 1
  models:
    "nousresearch/hermes-3-llama-3.1-405b:free":
      description: "Hermes 3 Llama 3.1 405B via OpenRouter"
      context_window: 131072
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.00
        output_per_1m: 0.00
    "meta-llama/llama-3.3-70b-instruct:free":
      description: "Free Llama 3.3 70B Instruct via OpenRouter"
      context_window: 131072
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.00
        output_per_1m: 0.00
    "qwen/qwen3-coder:free":
      description: "Free Qwen 3 Coder via OpenRouter"
      context_window: 32768
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.00
        output_per_1m: 0.00
implementation_binding:
  adapter_id: "openrouter"
  env_required: ["OPENROUTER_API_KEY"]
---
# OpenRouter Provider Profile

This document is the **source of truth** for OpenRouter's rate limits and configurations within `ai-api`.
Because OpenRouter is an aggregator, rate limits on the free tier can vary heavily by model. The limits defined here act as our safest global baseline for `:free` endpoints to prevent 429s.

## Maintenance
*   **Monitor Limits:** Check `https://openrouter.ai/docs#rate-limits` and their Discord for changes to free tier caps.
*   **Sync to Code:** Run `pnpm run knowledge:sync` after editing this file to propagate the limits into the runtime config (`provider-registry.json`).

## Related
- [Groq](./groq.md) — sibling adapter.
- [Endpoints](../api/endpoints.md) — HTTP surface.