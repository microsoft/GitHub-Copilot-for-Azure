---
name: azure-ai
description: Azure AI Services including AI Search, Speech, Foundry, OpenAI, and Document Intelligence for search, speech, and AI model capabilities.
---

# Azure AI Services

## Services Overview

| Service | Use When | MCP Tool |
|---------|----------|----------|
| AI Search | Full-text, vector, hybrid search | `azure__search` |
| Speech | Speech-to-text, text-to-speech | `azure__speech` |
| Foundry | AI models, agents, prompt flows | `azure__foundry` |
| OpenAI | GPT models, embeddings | `az cognitiveservices` |

## MCP Commands

**AI Search**: `search_index_list`, `search_index_get`, `search_query`

**Speech**: `speech_transcribe`, `speech_synthesize`

**Foundry**: `foundry_model_list`, `foundry_deployment_list`, `foundry_agent_list`

**Setup:** Run `/azure:setup` or `/mcp` to enable.

## External Documentation

- [AI Search](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [Speech](https://learn.microsoft.com/azure/ai-services/speech-service/overview)
- [Foundry](https://learn.microsoft.com/azure/ai-studio/what-is-ai-studio)
