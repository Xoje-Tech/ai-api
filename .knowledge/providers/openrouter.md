---
type: concept
title: "OpenRouter Provider"
description: "Documentation of available models, rate limits, and free-tier capabilities for OpenRouter."
tags: [provider, ai-api, openrouter]
timestamp: 2026-07-03T20:30:00Z
---

# OpenRouter

## Overview
OpenRouter is a unified API acting as a multiplexer to various AI models and providers. It offers a large rotating roster of "Free" models, making it an excellent fallback or variety provider in the `ai-api` balancer.

## Free Tier & Rate Limits
*Critical for tuning the CircuitBreakerBalancer.*
Free tier limits apply globally across all free models on OpenRouter, unless a specific model imposes strict upstream limits.
- **Requests per minute (RPM):** Typically 20 RPM for free tier / free models.
- **Tokens per minute (TPM):** Subject to abuse prevention algorithms, varies based on network load.
- **Requests per day (RPD):** ~200 RPD for free accounts (subject to fair use).
- **Tokens per day (TPD):** Uncapped strictly, but bounded by RPM/RPD fair use.

## Available Models (Free Tier)
OpenRouter has 20+ free models. A subset of the best free ones:

| Model ID | Context Window | Best For | Notes |
|---|---|---|---|
| `google/gemma-4-26b-a4b-it:free` | 262k | Broad reasoning, massive context | Excellent fallback |
| `nvidia/nemotron-3-ultra-550b-a55b:free`| 1M | Massive parameter tasks | Often rate-limited due to popularity |
| `cohere/north-mini-code:free` | 256k | Coding tasks | Fast fallback for dev queries |
| `poolside/laguna-xs-2.1:free` | 262k | Fast generation | |

*Note: Free model availability on OpenRouter fluctuates. The `:free` suffix is standard for their zero-cost routing.*

## Integration Quirks
- **OpenAI Compatible:** Yes (Use base URL `https://openrouter.ai/api/v1`)
- **Custom Headers:** **Required.** OpenRouter requires `HTTP-Referer` and `X-Title` headers for rankings and abuse tracking. Missing these may lead to degraded priority.
  ```http
  HTTP-Referer: https://your-site.com
  X-Title: AI-API Balancer
  ```
- **Streaming differences:** Standard SSE, but latency to first token (TTFT) is often much higher than direct providers like Groq due to the extra proxy hop.
