---
type: concept
title: "NVIDIA NIM Provider"
description: "Documentation of available models, rate limits, and free-tier capabilities for NVIDIA NIM."
tags: [provider, ai-api, nvidia]
timestamp: 2026-07-03T20:30:00Z
---

# NVIDIA NIM

## Overview
NVIDIA NIM (NVIDIA Inference Microservices) provides managed inference endpoints for top open-source models, fully accelerated by NVIDIA GPUs. They offer an evaluation tier for developers to test API endpoints (`integrate.api.nvidia.com`).

## Free Tier & Rate Limits
*Critical for tuning the CircuitBreakerBalancer.*
NVIDIA's developer evaluation tier operates on a credit system rather than a strict perpetual free tier like Groq.
- **Credits:** Developers typically receive **1,000 free credits** upon signing up with an NVIDIA Developer account (valid for 90 days).
- **Requests per minute (RPM) / Concurrency:** Varies by model, but generally suitable for low-to-medium throughput testing. Hard limits are usually enforced to prevent production-scale abuse on the evaluation tier.
- **Cost structure:** Usage drains the 1,000 credits based on the parameter size of the model.

## Available Models (Free Endpoint / Partner Endpoint)
NVIDIA NIM hosts a massive catalogue of 70+ models across various modalities (Image-to-Text, Code Generation, RAG).

| Model ID | Context Window | Best For | Notes |
|---|---|---|---|
| `meta/llama-3.1-405b-instruct` | 128k | Extreme scale reasoning | High parameter count, consumes more credits |
| `nvidia/nemotron-4-340b-instruct` | 4k | General reasoning, coding | NVIDIA's flagship open model |
| `mistralai/mixtral-8x22b-instruct-v0.1` | 64k | Mixture of Experts tasks | |
| `google/gemma-2-27b-it` | 8k | Medium-sized dense tasks | |
| `microsoft/phi-3-vision-128k-instruct` | 128k | Multimodal (Vision) | |

## Integration Quirks
- **OpenAI Compatible:** Yes (Drop-in replacement for OpenAI SDK).
  - **Base URL:** `https://integrate.api.nvidia.com/v1`
- **Custom Headers:** None required beyond standard `Authorization: Bearer <NVIDIA_API_KEY>`.
- **Model specific paths:** Some specific endpoints (like Vision models) might require `max_tokens` to be explicitly passed as they might not have a generous default.
- **Evaluation vs Production:** The evaluation endpoint (`integrate.api.nvidia.com`) is explicitly not for production workloads once you scale.
