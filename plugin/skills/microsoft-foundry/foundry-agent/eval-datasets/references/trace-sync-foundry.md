# Sync Datasets to Foundry

Upload local trace-harvested datasets to Foundry-connected storage and register them for server-side evaluation. Part of the [Trace-to-Dataset Pipeline](trace-to-dataset.md).

## Step 5 -- Sync Local Cache with Foundry (Optional)

Refresh or register the local cache in Foundry so it is available for server-side evaluations, shared access, and CI/CD pipelines. Reuse the local cache when it is current, and only refresh or push after user confirmation.

### 5a. Discover Storage Connection

Use `project_connection_list` to find an existing `AzureStorageAccount` connection on the Foundry project:

```
project_connection_list(foundryProjectResourceId, category: "AzureStorageAccount")
```

- **Found** -> use its `connectionName` and `target` (storage account URL)
- **Not found** -> proceed to 5b

### 5b. Create Storage Connection (if needed)

Ask the user for a storage account, then create a project connection:

```
project_connection_create(
  foundryProjectResourceId,
  connectionName: "datasets-storage",
  category: "AzureStorageAccount",
  target: "https://<storage-account>.blob.core.windows.net",
  authType: "AAD"
)
```

> Tip: The storage account must be in the same subscription or the user must have access. AAD auth is preferred -- it uses the caller's identity.

### 5c. Upload JSONL to Blob Storage

Upload the local dataset file to the same `eval-datasets` container used for seed datasets so all Foundry-registered eval datasets follow one storage pattern:

```bash
az storage blob upload \
  --account-name <storage-account> \
  --container-name eval-datasets \
  --name <agent-name>/<agent-name>-<source>-v<N>.jsonl \
  --file .foundry/datasets/<agent-name>-<source>-v<N>.jsonl \
  --auth-mode login
```

The local dataset filename should start with the selected Foundry agent name before the source/stage/version suffixes so trace-derived datasets stay grouped with the owning agent.

> [!] **Always pass `--auth-mode login`** to use AAD credentials. If the container doesn't exist, create it first with `az storage container create`.

### 5d. Register Dataset in Foundry

Use `evaluation_dataset_create` with the blob URI and the `AzureStorageAccount` `connectionName` discovered in 5a or created in 5b. While `connectionName` can be optional in other MCP flows, include it in this workflow so the dataset is bound to the project-connected storage account:

```
evaluation_dataset_create(
  projectEndpoint: "<project-endpoint>",
  datasetContentUri: "https://<storage-account>.blob.core.windows.net/eval-datasets/<agent-name>/<agent-name>-<source>-v<N>.jsonl",
  connectionName: "datasets-storage",
  datasetName: "<agent-name>-<source>",
  datasetVersion: "v<N>"
)
```

### 5e. Verify

Confirm the dataset is registered:

```
evaluation_dataset_get(projectEndpoint, datasetName: "<agent-name>-<source>", datasetVersion: "v<N>")
```

Display the registered dataset details to the user. Update `.foundry/datasets/manifest.json` with `"synced": true` and the server-side dataset name/version.
