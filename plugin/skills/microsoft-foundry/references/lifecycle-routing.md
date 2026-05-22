# Lifecycle Routing

Route user intent to the correct workflow by matching against these tables.

## Infrastructure Lifecycle

| User Intent | Workflow |
|-------------|---------|
| "Create Foundry" / "Set up Foundry" (ambiguous) | Use `AskUserQuestion`: (a) just an AI Services resource, (b) a project with public access, or (c) a project with network isolation? Route: (a) -> [resource/create](../resource/create/create-foundry-resource.md), (b) -> [project/create](../project/create/create-foundry-project.md), (c) -> [private-network](../resource/private-network/private-network.md) |
| Set up Foundry with VNet isolation | [private-network](../resource/private-network/private-network.md) |
| Create a Foundry project (public) | [project/create](../project/create/create-foundry-project.md) |
| Create a bare Foundry resource | [resource/create](../resource/create/create-foundry-resource.md) |

## Agent Development Lifecycle

Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create a new agent from scratch | [create](../foundry-agent/create/create-hosted.md) -> [deploy](../foundry-agent/deploy/deploy.md) -> [invoke](../foundry-agent/invoke/invoke.md) |
| Make existing Python agent FAOS optimizable | [faos-optimize](../foundry-agent/faos-optimize/faos-optimize.md) -> review -> deploy -> invoke |
| Deploy an agent (code already exists) | deploy -> invoke |
| Update/redeploy an agent after code changes | deploy -> invoke |
| Invoke/test/chat with an agent | invoke |
| Optimize / improve agent prompt or instructions | observe (Step 4: Optimize) |
| Evaluate and optimize agent (full loop) | observe |
| Enable continuous evaluation monitoring | observe (Step 6: CI/CD & Monitoring) |
| Troubleshoot an agent issue | invoke -> troubleshoot |
| Fix a broken agent (troubleshoot + redeploy) | invoke -> troubleshoot -> apply fixes -> deploy -> invoke |
