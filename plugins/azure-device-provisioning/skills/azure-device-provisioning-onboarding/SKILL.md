---
name: azure-device-provisioning-onboarding
description: "Guide read-only Azure IoT Device Provisioning Service onboarding validation through Azure MCP. Routes 1-10 devices directly and larger fleets through safe batching, checkpointing, resume, and aggregation. WHEN: \"validate DPS onboarding\", \"check device certificates before provisioning\", \"compare DPS preflight with registration state\", \"validate a DPS device fleet\", \"resume DPS fleet validation\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure Device Provisioning Onboarding

Validate whether devices are ready to provision through Azure IoT Device Provisioning Service (DPS).

## Route

| Request | Action |
|---|---|
| 1-10 devices | Call the Azure MCP `deviceprovisioning onboarding validate` tool once. |
| More than 10 devices | Follow [Fleet workflow](references/fleet-workflow.md). |
| Revalidation | Include registration state and compare actual assignment with the intended Hub. |
| Full evidence requested | Request detailed device results; otherwise keep the compact response. |

Use the registered Azure MCP tool matching `deviceprovisioning_onboarding_validate`; clients may add
a server prefix. If unavailable, tell the user that their Azure MCP version does not contain the
command. Do not replace it with shell loops, direct REST calls, or local certificate validation.

Read [Validation workflow](references/validation-workflow.md) before invoking the tool and
[Reporting](references/reporting.md) before presenting results.

## Safety

- Read-only: never create enrollments, register devices, change assignments, or delete state.
- Accept only public certificate chains or public TPM endorsement keys.
- Reject private keys, symmetric keys, connection strings, and DPS credentials.
- Never claim that validation proves private-key possession or guarantees physical-device success.
