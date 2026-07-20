# Azure Functions Templates

Dynamic template selection for Azure Functions projects. **The driver fetches templates for
you** — your job is to identify the right `resource` + `language` so it can retrieve the
matching AZD template (complete with IaC, RBAC, and managed identity).

## Step 1: Identify the Template

Use the intent→resource mapping in [selection.md](selection.md) to map user intent to a
`resource` value, then choose the `language` and IaC:

- `resource` — trigger type (http, cosmos, timer, eventhub, servicebus, blob, sql, mcp, durable)
- `language` — python, csharp, typescript, javascript, java, powershell
- IaC — `bicep` (default), or `terraform` if the user requests it

> **Default behavior:** When user intent cannot be determined or no trigger type is known, use `http`.

## Step 2: Hand Off to the Driver

Set `input.functionsTemplate = { resource, language }`. The driver then discovers the
available templates and filters by `resource` + IaC. If exactly one matches, it fetches that
one automatically; if several match, it asks you to set `input.functionsTemplate.templateName`
— pick one from `auto.functionsTemplateCandidates` (each entry has templateName + description).
The driver fetches your choice. You do **not** call any template tool or CLI yourself.

## Step 3: Review What the Driver Fetched

Read `auto.functionsTemplate` = `{ fetched, id, placement, path, files, reason }`:

- `fetched:true` → the complete project (function source, `infra/`, `azure.yaml`,
  `host.json`, dependencies) was written into the repo. Review `files[]`, wire in the app
  logic, and apply required edits (secret-storage type, managed identity). **PRESERVE the
  generated IaC security patterns** — keep RBAC, managed identity, and security config intact.
- `fetched:false`, reason `no-template-use-references` → no matching template exists.
  Compose from the reference patterns below.
- `fetched:false`, reason `fetch-failed` → the driver could not retrieve a template; fall
  back to the reference patterns below.

> **Skip content verification** — driver-fetched template files are pre-validated. After the
> driver writes them, do not `view`/`cat` files unless you customized them.

> NEVER hand-write Bicep/Terraform. The Functions bicep.md/terraform.md files are REFERENCE
> DOCS for composition, not templates to copy.

## Step 4: Deploy

```bash
azd env set AZURE_LOCATION <region>
azd up --no-prompt
```

---

## Recipe Composition (Multiple Templates)

When the user needs a trigger + bindings that no single template covers, compose from the
reference patterns:

1. Use the trigger recipe as the base (complete project structure)
2. Extract binding patterns from the binding recipes
3. Merge IaC resources and RBAC roles
4. Add the user's custom logic
5. Trim unused demo code from samples

> **AzureWebJobsStorage exception**: Always keep the storage account + RBAC — the runtime requires it.

See [composition.md](recipes/composition.md) for the full algorithm.

---

## References

- [Composition Details](recipes/composition.md) — recipe algorithm
- [Selection Guide](selection.md) — intent→resource mapping
- [Recipes Index](recipes/README.md) — all available recipes
- [Base Template Eval](base/eval/summary.md) — HTTP base evaluation results

**Browse all:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)
