---
type: Provider Profile
title: Groq
description: Fast LLM inference engine using LPUs. Focuses on low latency.
resource_url: https://console.groq.com/docs/rate-limits
tags: [provider, free-tier, groq, llm, ai-balancer, streaming]
timestamp: 2026-07-04T12:00:00Z
provider_config:
  tier_status: "free"
  tier_type: "account-bound"
  usage_limits:
    rpm: 30
    rpd: 14400
    tpm: 6000
    tpd: 500000
    concurrent_requests: 1
  models:
    "llama3.1-8b":
      description: "Meta Llama 3.1 8B Instruct"
      context_window: 8192
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.05
        output_per_1m: 0.08
    "llama3.3-70b":
      description: "Meta Llama 3.3 70B Instruct"
      context_window: 8192
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.59
        output_per_1m: 0.79
    "openai/gpt-oss-120b":
      description: "GPT OSS 120B (Groq variant)"
      context_window: 32768
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0.24
        output_per_1m: 0.24
    "qwen/qwen3-32b":
      description: "Qwen 3 32B Instruct"
      context_window: 32768
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.07
        output_per_1m: 0.07
implementation_binding:
  adapter_id: "groq"
  env_required: ["GROQ_API_KEY"]
---
# Groq Provider Profile

This document is the **source of truth** for Groq's rate limits and configurations within `ai-api`.

## Maintenance
*   **Monitor Limits:** Check `https://console.groq.com/docs/rate-limits` regularly.
*   **Sync to Code:** Run `pnpm run knowledge:sync` after editing this file to propagate the limits into the runtime config (`provider-registry.json`).

## Related
- [OpenRouter](./openrouter.md) — sibling adapter.
- [Endpoints](../api/endpoints.md) — HTTP surface.