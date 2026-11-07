# Validation Workflow

## Required context

Resolve these values before calling Azure MCP:

- subscription, resource group, and DPS instance;
- exactly one individual enrollment or enrollment group;
- optional intended IoT Hub;
- registration ID for each device;
- public X.509 chain or public TPM endorsement key when supplied;
- whether stored registration state should be read.

For an individual enrollment, validate one matching registration ID. For an enrollment group, send
a `deviceManifest` containing 1-10 devices.

## Input validation

Before any Azure call:

1. Reject missing or duplicate registration IDs.
2. Reject private-key PEM markers, symmetric keys, connection strings, and secret-looking fields.
3. Allow at most one public identity-evidence type per device.
4. Resolve certificate files locally and send public PEM content, never local file paths.
5. Preserve source order so fleet batches and resume behavior are deterministic.

## Invoke Azure MCP

Call the registered tool matching:

```text
deviceprovisioning_onboarding_validate
```

Provide the DPS resource, enrollment target, intended Hub, registration-state preference, and public
device evidence. Use the default compact response. Request full device details only when the user
asks for evidence or an exceptional device requires explanation.

The tool is authoritative for enrollment, CA-reference, certificate-chain, allocation,
reprovisioning, and registration-state checks. Preserve its blocker, warning, informational, and
unverified severities.

If more than 10 devices are supplied, do not send a truncated manifest. Continue with
[Fleet workflow](fleet-workflow.md).
