# LangChain and LangGraph Hosting

Preserve the existing application and choose the least invasive hosting path that meets the requested contract. Reading guidance does not authorize execution.

## Existing Application: Plan or Local Work

Read the application's entry point, configuration and acceptance requirements first. Inspect only task-relevant public signatures and guide headings; follow implementation detail only for an unresolved contract or observed failure. Do not enter scaffold, deployment, cloud invocation or metadata workflows for a local task.

- Preserve graph exports/mappings, factory signatures, providers, tools, prompts, checkpointers and client inputs/outputs. Add separate hosting configuration or a small adapter where necessary; do not replace the application with a sample.
- Make configuration available before graph initialization. A runner may not load graph JSON's `env` entry. If construction is invocation-time, read configuration then; do not freeze a tenant or change an existing required-argument factory into a zero-argument public API.
- Reuse public hosting/storage APIs and preserve caller-supplied state-root ownership. Add custom stores, locking, persistence or recovery only for a concrete requested lifetime or demonstrated default-path requirement.
- Verify original behavior and the requested hosting contract: terminal status, actual output and requested streaming. Enter native ASGI lifecycle for in-process tests and probe the host's `/readiness`; echoed `READY` output is not native readiness evidence. Bound cleanup of owned servers. Expand validation for a failure or uncovered requirement, not by default.
- A plan ends with source-grounded facts, minimal proposed changes, required validation and unverified boundaries. Local work does not install cloud tooling, access Azure or claim cloud/durability/isolation acceptance merely to make the migration complete.

## Minimal Public Local Composition

For a checkpoint-free local message graph, this public composition can be the body of the existing zero-argument ASGI factory. `make_hosted_graph` denotes the application's selected graph factory from the separate hosting configuration; adapt that binding, not the original graph or its public signature.

```python
from azure.ai.agentserver.responses import InMemoryResponseProvider
from langchain_azure_ai.agents.hosting import ResponsesAgentServerHost, ResponsesHostServer


def create_app():
    graph = make_hosted_graph()
    host = ResponsesAgentServerHost(
        store=InMemoryResponseProvider(),
        configure_observability=None,
    )
    return ResponsesHostServer(graph, app=host).app
```

Use the selected factory directly; this checkpoint-free example needs no helper class, custom conversation store or private provider import. `InMemoryResponseProvider` selects response history storage, not graph checkpoints or conversation storage. It does not make the entire host durable or universally offline. For checkpointed graphs, preserve the checkpointer and verify invocation-time conversation/thread bindings and their existing storage requirements. `configure_observability=None` omits the setup callback, not inherited exporters or loggers. Preserve custom graph/client conversion hooks when required.

For in-process tests, enter `app.router.lifespan_context(app)` around `httpx.ASGITransport(app=app)`; check native `/readiness`, actual non-streaming and requested SSE terminal output/status. For cleanup that must support Python 3.10, use `contextlib.ExitStack.enter_context` or `try/finally`, not Python 3.11-only `TestCase.enterContext`. Report the installed package's version requirements and untested versions; a Python 3.13 test is not a 3.10–3.14 matrix. Do not blanket-mock socket connections as offline proof: it can break Windows asyncio's loopback socketpair. State the tested enforcement boundary.

## Hosting and Protocol Decisions

Prefer configuration-only hosting when configuration expresses the required behavior. Use host-server integration only for custom request/protocol/lifecycle behavior that requires it, not merely because agent code already exists.

For a compiled LangGraph, use the integrated `langchain_azure_ai.agents.hosting.ResponsesHostServer` with `langchain-azure-ai[hosting]` unless a concrete protocol requirement prevents it. A lower-level handler that calls `ainvoke` and returns only `TextResponse` is not an equivalent adapter: it can discard tool events, graph state and conversation/thread routing.

Inspect the original launch configuration before interpreting a graph without an explicit checkpointer as stateless. LangGraph's development server can supply persistence outside `agent.py`. Preserve that existing behavior when moving runtimes; a small executable host integration is justified if configuration-only hosting cannot express the required checkpointer lifetime. Preserve explicit existing backends, isolation keys and public development exports; this does not authorize replacing an established backend or migrating historical checkpoints.

For requested state that must survive a new hosted session, use the installed SDK's supported durable backend, such as `FoundryCheckpointSaver`, with its context alive for the entire server lifetime. Do not initialize and immediately close it at import time. Use native hosted credential defaults, not developer credentials. Keep an explicit in-memory local composition separate from the durable hosted path; local continuity is not cloud durability or cross-user isolation evidence.

| Existing contract | Decision |
|---|---|
| Compatible message inputs/outputs and graph state | Responses runner; preserve graph selection |
| Custom inputs/outputs or state shape | Honor the requested protocol using documented adapter hooks where needed; shape alone does not authorize switching the client API |
| LangGraph Server runs/threads/state APIs, Studio or custom HTTP routes | Responses hosting does not preserve these; identify client adaptation or a retained service |

## Deployment or Durable State: Only When Requested

For deployment, read [deploy](../../deploy/deploy.md) for the selected azd environment and remote dependency closure. For cloud invocation, read [SDK operations](sdk-operations.md). Developer access is not runtime-principal authorization.

Response history is not a graph checkpoint. Preserve the existing checkpointer unless change is authorized. For requested cross-compute graph/file durability or unfinished-request recovery, use existing SDK guidance: durable graph progress plus host `resilient_background=true` and request `background=true, store=true`; streaming is not categorically excluded. Retrieving the original response is not resubmitting work.

Separate migration acceptance from business-output quality. Verify retained instructions/tools, real model/tool calls, actual saved-file readback, later revision and required state boundaries. Citation style or report wording is an application contract, not a generic Foundry hosting assertion; assess it separately unless explicitly in scope. Do not rewrite prompts, add repair middleware, fabricate artifacts or strengthen business validators to pass a hosting check. An active deployment or Echo response is insufficient. Untested boundaries remain unverified.

## Sample Selection: Scaffolding Only

Use the parent workflow's selection guidance when scaffolding is requested. Existing applications reuse patterns, not sample application structure:

- [Configuration-driven Responses/LangGraph](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml)
- [Configuration-driven Invocations/LangGraph](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml)
