# Contoso enterprise knowledge

Use when the user asks for an Agent connected to Contoso enterprise documents or policies. Never create, replace, or reconfigure an already pre-provisioned Search connection or Toolbox.

## Step 1: Select the Foundry project, model, and Agent kind

1. Run `foundryx access project list`: `foundryx-poc` is pre-provisioned for private-preview users with the `contoso-search` connection and `contoso-enterprise-docs` Toolbox already set up, so recommend `foundryx-poc` when present; if the user does not have `foundryx-poc`, tell the user that an admin needs to set up a new project, Search connection, and Toolbox in their environment (it does not need to use the `foundryx-poc` naming).
2. Pick a ready chat deployment from `foundryx model list --project <project-id>` (such as `gpt-5-mini`; verify readiness first).
3. Confirm `Prompt` vs `Hosted` if unspecified.
4. Set instructions to retrieve before answering Contoso questions, rely strictly on retrieved facts with document/section citations, state when information is missing, and never invent approvals or public download links (the corpus is fictional trial content).

## Step 2: Configure and deploy by Agent kind

### Branch A — Prompt Agent

Add the prepared Search index under `agent.tools` in `foundryx.yaml` and run `foundryx agent deploy` (report any unsupported-tool error as a service/client compatibility issue without silently changing Agent kind or bypassing FoundryX):

```yaml
tools:
  - type: azure_ai_search
    azure_ai_search:
      indexes:
        - project_connection_id: contoso-search
          index_name: contoso-docs
          query_type: simple
          top_k: 5
```

### Branch B — Hosted Agent

1. Run `foundryx agent init [directory] --sample toolbox`.
2. Derive `TOOLBOX_ENDPOINT` from the selected project's `arm_id` per [Hosted Agent Toolbox](hosted-agent-toolbox.md) using Toolbox name `contoso-enterprise-docs`, and set it in `main.py` (do not set `TOOLBOX_NAME` or create the sample's example Toolbox).
3. Configure `project`, `name`, and `model` in `foundryx.yaml` (no `agent.tools` or env fields), then run `foundryx agent deploy` (skip local `agent run` / `--local`).

## Step 3: Verify retrieval

```text
foundryx agent invoke "What is the domestic hotel limit and when are expenses due?" --agent-id <agent-id> --project <project-id>
```

Expected trial facts: **USD 220 per night** before taxes; submit travel expenses within **30 calendar days** after the trip. Confirm retrieval evidence/citations (not just plausible answer text) and report tool failures rather than guessing.



