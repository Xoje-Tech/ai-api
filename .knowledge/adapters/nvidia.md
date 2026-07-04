---
type: Provider Profile
title: NVIDIA NIM
description: NVIDIA Inference Microservices. Focuses on specialized hardware capabilities.
resource_url: https://build.nvidia.com/explore/discover
tags: [provider, free-tier, nvidia, nim, llm, ai-balancer]
timestamp: 2026-07-04T12:00:00Z
provider_config:
  tier_status: "free"
  tier_type: "model-bound"
  usage_limits:
    rpm: 40
    rpd: 57600
    tpm: 100000
    tpd: 1000000
    concurrent_requests: 1
  models:
    "meta/llama-3.1-70b-instruct":
      description: "Meta Llama 3.1 70B Instruct via NIM"
      context_window: 131072
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.00
        output_per_1m: 0.00
    "mistralai/mixtral-8x22b-instruct-v0.1":
      description: "Mistral Mixtral 8x22B Instruct via NIM"
      context_window: 65536
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0.00
        output_per_1m: 0.00
implementation_binding:
  adapter_id: "nvidia"
  env_required: ["NVIDIA_API_KEY"]
---
# NVIDIA NIM Provider Profile

This document is the **source of truth** for NVIDIA NIM rate limits and configurations within `ai-api`.

## Maintenance
*   **Monitor Limits:** Check `https://build.nvidia.com/explore/discover` or API docs regularly. Models tend to have their own context window limits here, and phone number verification is required to use this tier.
*   **Sync to Code:** Run `pnpm run knowledge:sync` after editing this file to propagate the limits into the runtime config (`provider-registry.json`).

## Related
- [Endpoints](../api/endpoints.md) — HTTP surface.