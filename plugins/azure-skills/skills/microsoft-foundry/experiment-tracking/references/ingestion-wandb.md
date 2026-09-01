# Telemetry Ingestion and W&B Compatibility

## OpenTelemetry ingestion

OTLP metrics, logs, and traces require protobuf payloads. Agent traces require JSON.

```bash
azd ai project ingest metrics --run-id <run-id> --file <metrics.pb>
azd ai project ingest logs --run-id <run-id> --file <logs.pb>
azd ai project ingest traces --run-id <run-id> --file <traces.pb>
azd ai project ingest agent-traces --run-id <run-id> --file <agent-traces.json>
```

Use `--file -` only when the user wants to pipe a non-empty payload through stdin. Confirm the file exists and is non-empty before executing. Do not decode or rewrite protobuf payloads.

## W&B-compatible requests

These commands send complete JSON request bodies:

```bash
azd ai project wandb graphql --file <request.json>
azd ai project wandb file-stream --run-id <run-id> --file <request.json>
```

Validate that request files contain JSON, but do not deserialize and reserialize them: escaped identifiers and large JSON numbers must remain unchanged.

Follow the parent azd guidance and set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` inline when executing each command. All commands return complete JSON service responses.
