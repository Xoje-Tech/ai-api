---
type: Provider Profile
title: OpenRouter
description: Unified API for multiple LLMs. We target their ":free" model variants as a load-balancing fallback.
resource_url: https://openrouter.ai/docs/api/reference/limits
tags:
  - provider
  - free-tier
  - openrouter
  - llm
  - ai-balancer
  - aggregator
timestamp: '2026-07-04T12:00:00Z'
provider_config:
  tier_status: free
  tier_type: model-bound
  usage_limits:
    rpm: 20
    rpd: 50
    tpm: 10000
    tpd: 100000
    concurrent_requests: 1
  models:
    poolside/laguna-xs-2.1:free:
      description: 'Poolside: Laguna XS 2.1 (free)'
      context_window: 262144
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    cohere/north-mini-code:free:
      description: 'Cohere: North Mini Code (free)'
      context_window: 256000
      max_output_tokens: 64000
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-3.5-content-safety:free:
      description: 'NVIDIA: Nemotron 3.5 Content Safety (free)'
      context_window: 128000
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-3-ultra-550b-a55b:free:
      description: 'NVIDIA: Nemotron 3 Ultra (free)'
      context_window: 1000000
      max_output_tokens: 65536
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free:
      description: 'NVIDIA: Nemotron 3 Nano Omni (free)'
      context_window: 256000
      max_output_tokens: 65536
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    poolside/laguna-xs.2:free:
      description: 'Poolside: Laguna XS.2 (free)'
      context_window: 262144
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    poolside/laguna-m.1:free:
      description: 'Poolside: Laguna M.1 (free)'
      context_window: 262144
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    google/gemma-4-26b-a4b-it:free:
      description: 'Google: Gemma 4 26B A4B  (free)'
      context_window: 262144
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    google/gemma-4-31b-it:free:
      description: 'Google: Gemma 4 31B (free)'
      context_window: 262144
      max_output_tokens: 8192
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    google/lyria-3-pro-preview:
      description: 'Google: Lyria 3 Pro Preview'
      context_window: 1048576
      max_output_tokens: 65536
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    google/lyria-3-clip-preview:
      description: 'Google: Lyria 3 Clip Preview'
      context_window: 1048576
      max_output_tokens: 65536
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-3-super-120b-a12b:free:
      description: 'NVIDIA: Nemotron 3 Super (free)'
      context_window: 1000000
      max_output_tokens: 262144
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    openrouter/free:
      description: Free Models Router
      context_window: 200000
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    liquid/lfm-2.5-1.2b-thinking:free:
      description: 'LiquidAI: LFM2.5-1.2B-Thinking (free)'
      context_window: 32768
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    liquid/lfm-2.5-1.2b-instruct:free:
      description: 'LiquidAI: LFM2.5-1.2B-Instruct (free)'
      context_window: 32768
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-3-nano-30b-a3b:free:
      description: 'NVIDIA: Nemotron 3 Nano 30B A3B (free)'
      context_window: 256000
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-nano-12b-v2-vl:free:
      description: 'NVIDIA: Nemotron Nano 12B 2 VL (free)'
      context_window: 128000
      max_output_tokens: 128000
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    qwen/qwen3-next-80b-a3b-instruct:free:
      description: 'Qwen: Qwen3 Next 80B A3B Instruct (free)'
      context_window: 262144
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nvidia/nemotron-nano-9b-v2:free:
      description: 'NVIDIA: Nemotron Nano 9B V2 (free)'
      context_window: 128000
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    openai/gpt-oss-120b:free:
      description: 'OpenAI: gpt-oss-120b (free)'
      context_window: 131072
      max_output_tokens: 131072
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    openai/gpt-oss-20b:free:
      description: 'OpenAI: gpt-oss-20b (free)'
      context_window: 131072
      max_output_tokens: 32768
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    qwen/qwen3-coder:free:
      description: 'Qwen: Qwen3 Coder 480B A35B (free)'
      context_window: 1048576
      max_output_tokens: 262000
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    cognitivecomputations/dolphin-mistral-24b-venice-edition:free:
      description: 'Venice: Uncensored (free)'
      context_window: 32768
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    meta-llama/llama-3.3-70b-instruct:free:
      description: 'Meta: Llama 3.3 70B Instruct (free)'
      context_window: 131072
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    meta-llama/llama-3.2-3b-instruct:free:
      description: 'Meta: Llama 3.2 3B Instruct (free)'
      context_window: 131072
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
    nousresearch/hermes-3-llama-3.1-405b:free:
      description: 'Nous: Hermes 3 405B Instruct (free)'
      context_window: 131072
      max_output_tokens: 4096
      pricing:
        input_per_1m: 0
        output_per_1m: 0
implementation_binding:
  adapter_id: openrouter
  env_required:
    - OPENROUTER_API_KEY
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