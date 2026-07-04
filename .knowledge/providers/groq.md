---
type: concept
title: "Groq Provider"
description: "Documentation of available models, rate limits, and free-tier capabilities for Groq."
tags: [provider, ai-api, groq]
timestamp: 2026-07-03T20:30:00Z
---

# Groq

## Overview
Groq is a high-performance AI inference provider offering extremely fast token generation using custom LPU (Language Processing Unit) hardware. It is ideal as the primary fast-response provider in the `ai-api` balancer.

## Free Tier & Rate Limits
*Critical for tuning the CircuitBreakerBalancer.*
Limits vary heavily by model. The default limits for common models on the Free Plan:
- **Requests per minute (RPM):** 30 (across most text models), 20 (for Whisper)
- **Requests per day (RPD):** Ranges from 1K to 14.4K depending on the model size.
- **Tokens per minute (TPM):** 6K to 12K depending on model.
- **Tokens per day (TPD):** 100K to 500K.

*Example specific limits:*
- `llama-3.1-8b-instant`: 30 RPM / 6K TPM / 500K TPD
- `llama-3.3-70b-versatile`: 30 RPM / 12K TPM / 100K TPD

## Available Models (Free Tier)
| Model ID | Context Window | Best For | Notes |
|---|---|---|---|
| `llama-3.1-8b-instant` | 8k | Fast responses, low latency | Generous RPD limit (14.4K) |
| `llama-3.3-70b-versatile` | 8k (API limited) | Complex reasoning | Stricter RPD limit (1K) |
| `qwen/qwen3.6-27b` | 8k | Alternative architecture | 30 RPM, 8K TPM |
| `whisper-large-v3` | Audio | Speech-to-text | Audio models use ASH/ASD (Audio Seconds limits) |

## Integration Quirks
- **OpenAI Compatible:** Yes (Drop-in replacement for OpenAI SDK base URL `https://api.groq.com/openai/v1`)
- **Custom Headers:** None required beyond standard `Authorization: Bearer`.
- **Streaming differences:** Standard SSE, identical to OpenAI. Sometimes extremely fast token bursts can overwhelm naive client-side parsers.
