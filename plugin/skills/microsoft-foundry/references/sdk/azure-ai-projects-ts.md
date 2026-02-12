# AI Projects — TypeScript SDK Quick Reference

> Condensed from **azure-ai-projects-ts**. Full patterns (agents,
> connections, deployments, datasets, indexes, evaluators)
> in the **azure-ai-projects-ts** plugin skill if installed.

## Install
npm install @azure/ai-projects @azure/identity

## Quick Start
```typescript
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
const client = new AIProjectClient(process.env.AZURE_AI_PROJECT_ENDPOINT!, new DefaultAzureCredential());
```

## Best Practices
- Use getOpenAIClient() for responses, conversations, files, and vector stores
- Version your agents — use `createVersion` for reproducible agent definitions
- Clean up resources — delete agents, conversations when done
- Use connections — get credentials from project connections, don't hardcode
- Filter deployments — use `modelPublisher` filter to find specific models
