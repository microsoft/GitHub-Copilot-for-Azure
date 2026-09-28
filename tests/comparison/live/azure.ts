import { AzureCliCredential } from "@azure/identity";

export const ARM = "https://management.azure.com";
const ARM_VERSION = "2025-06-01";
export type JsonObject = Record<string, unknown>;
export type RequestJson = (url: string, method?: string, body?: unknown) => Promise<unknown>;

export function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Expected ${label} object.`);
  return value as JsonObject;
}

export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${label}.`);
  return value;
}

export function resourceGroupUrl(subscription: string, group: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(subscription) || !/^rg-vally-foundry-[a-f0-9]{12}-(claude|copilot)$/.test(group)) {
    throw new Error("Invalid live-eval subscription or owned resource group.");
  }
  return `${ARM}/subscriptions/${subscription}/resourceGroups/${group}`;
}

export class AzureHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function azureRequest(subscription: string): RequestJson {
  const credential = new AzureCliCredential({ subscription, processTimeoutInMs: 30_000 });
  return async (url, method = "GET", body) => {
    const parsed = new URL(url);
    const management = parsed.origin === ARM;
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
      || (!management && !/^[a-z0-9-]+\.services\.ai\.azure\.com$/i.test(parsed.hostname))) {
      throw new Error("Refusing to send Azure credentials to an untrusted endpoint.");
    }
    const token = await credential.getToken(management ? `${ARM}/.default` : "https://ai.azure.com/.default");
    const response = await fetch(url, {
      method, redirect: "error", signal: AbortSignal.timeout(180_000),
      headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    if (!response.ok) throw new AzureHttpError(response.status, `Azure ${method} failed (${response.status}): ${raw.slice(0, 1500)}`);
    if (!raw.trim()) return null;
    return JSON.parse(raw) as unknown;
  };
}

async function collection(url: string, request: RequestJson): Promise<unknown[]> {
  const original = new URL(url);
  const visited = new Set<string>();
  const items: unknown[] = [];
  let next: string | undefined = url;
  while (next) {
    const page = new URL(next, original);
    if (page.origin !== original.origin || page.pathname !== original.pathname
      || page.username || page.password || visited.has(page.href) || visited.size >= 100) {
      throw new Error("Unsafe, repeated, or excessive Azure inventory pagination.");
    }
    visited.add(page.href);
    const response = object(await request(page.href), "Azure collection");
    if (!Array.isArray(response.value)) throw new Error("Missing Azure collection value.");
    items.push(...response.value);
    next = response.nextLink ? text(response.nextLink, "inventory nextLink") : undefined;
  }
  return items;
}

export async function assertOwnership(
  subscription: string, group: string, owner: string, request: RequestJson,
): Promise<void> {
  const resource = object(await request(`${resourceGroupUrl(subscription, group)}?api-version=2022-09-01`), "resource group");
  const tags = resource.tags === undefined ? {} : object(resource.tags, "resource group tags");
  if (tags["vally-run"] === owner) return;
  if (tags["vally-run"] !== undefined) throw new Error(`Ownership tag mismatch for ${group}; refusing scoped operation.`);
  // azd may replace group tags. A completed empty deployment recorded before
  // launching the agent retains the run marker without provisioning resources.
  const marker = object(await request(ownershipMarkerUrl(subscription, group, owner)), "ownership deployment");
  const properties = object(marker.properties, "ownership deployment properties");
  const output = object(object(properties.outputs, "ownership outputs").vallyRun, "ownership output");
  if (properties.provisioningState !== "Succeeded" || output.value !== owner) {
    throw new Error(`Ownership deployment mismatch for ${group}; refusing scoped operation.`);
  }
}

function ownershipMarkerUrl(subscription: string, group: string, owner: string): string {
  if (!/^[a-f0-9]{12}$/.test(owner) || !group.startsWith(`rg-vally-foundry-${owner}-`)) {
    throw new Error("Invalid ownership marker scope.");
  }
  return `${resourceGroupUrl(subscription, group)}/providers/Microsoft.Resources/deployments/vally-owner-${owner}?api-version=2022-09-01`;
}

export async function createGroup(
  subscription: string, group: string, owner: string, location: string, request: RequestJson,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<void> {
  const url = `${resourceGroupUrl(subscription, group)}?api-version=2022-09-01`;
  let exists = true;
  try {
    await request(url);
  } catch (error) {
    if (!(error instanceof AzureHttpError) || error.status !== 404) throw error;
    exists = false;
  }
  if (exists) throw new Error(`Resource group already exists: ${group}. It will not be reused or deleted.`);
  try {
    await request(url, "PUT", { location, tags: { "vally-run": owner, purpose: "foundry-live-eval" } });
    await assertOwnership(subscription, group, owner, request);
    const markerUrl = ownershipMarkerUrl(subscription, group, owner);
    let marker = object(await request(markerUrl, "PUT", {
      properties: {
        mode: "Incremental",
        template: {
          $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
          contentVersion: "1.0.0.0", resources: [],
          outputs: { vallyRun: { type: "string", value: owner } },
        },
      },
    }), "ownership deployment");
    for (let attempt = 0; object(marker.properties, "ownership properties").provisioningState !== "Succeeded"; attempt++) {
      const state = object(marker.properties, "ownership properties").provisioningState;
      if (["Failed", "Canceled"].includes(String(state)) || attempt >= 24) {
        throw new Error(`Ownership deployment did not succeed for ${group}: ${String(state)}`);
      }
      await pause(5_000);
      marker = object(await request(markerUrl), "ownership deployment");
    }
  } catch (creationError) {
    // A timed-out PUT may still have created the group. Reconcile before
    // returning, but never delete a group without a matching ownership marker.
    try {
      await assertOwnership(subscription, group, owner, request);
    } catch (lookupError) {
      if (lookupError instanceof AzureHttpError && lookupError.status === 404) throw creationError;
      throw new AggregateError([creationError, lookupError], `Creation state uncertain for ${group}; inspect ownership before cleanup.`, { cause: lookupError });
    }
    await deleteGroup(subscription, group, owner, request, pause);
    throw creationError;
  }
}

export async function deleteGroup(
  subscription: string, group: string, owner: string, request: RequestJson,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<void> {
  const url = `${resourceGroupUrl(subscription, group)}?api-version=2022-09-01`;
  await assertOwnership(subscription, group, owner, request);
  await request(url, "DELETE");
  for (let attempt = 0; attempt < 60; attempt++) {
    await pause(10_000);
    try {
      await request(url);
    } catch (error) {
      if (error instanceof AzureHttpError && error.status === 404) return;
      throw error;
    }
  }
  throw new Error(`Cleanup not confirmed after 10 minutes: ${group}. Check Azure before leaving resources running.`);
}

export function responseText(response: unknown): string {
  const result = object(response, "Responses API response");
  if (result.status !== "completed" || result.error) throw new Error("Remote response was not completed successfully.");
  if (!Array.isArray(result.output)) throw new Error("Remote response has no output array.");
  const pieces: string[] = [];
  for (const raw of result.output) {
    const message = object(raw, "output item");
    if (message.type !== "message" || message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const rawPart of message.content) {
      const part = object(rawPart, "message content");
      if (part.type === "output_text") pieces.push(text(part.text, "assistant text"));
    }
  }
  if (!pieces.length) throw new Error("Remote response has no assistant output text.");
  return pieces.join("\n");
}

export async function verifyHostedAgent(
  subscription: string, group: string, owner: string, agentName: string, request: RequestJson,
): Promise<JsonObject> {
  await assertOwnership(subscription, group, owner, request);
  const base = resourceGroupUrl(subscription, group);
  const accounts = await collection(`${base}/providers/Microsoft.CognitiveServices/accounts?api-version=${ARM_VERSION}`, request);
  if (accounts.length !== 1) throw new Error(`Expected one new Foundry account, found ${accounts.length}.`);
  const account = object(accounts[0], "Foundry account");
  if (account.kind !== "AIServices") throw new Error("Deployed account is not an AIServices Foundry account.");
  const accountId = text(account.id, "account ID");
  if (!accountId.toLowerCase().startsWith(`${base.slice(ARM.length)}/providers/Microsoft.CognitiveServices/accounts/`.toLowerCase())) {
    throw new Error("Foundry account is outside the assigned resource group.");
  }
  const projects = await collection(`${ARM}${accountId}/projects?api-version=${ARM_VERSION}`, request);
  if (projects.length !== 1) throw new Error(`Expected one new Foundry project, found ${projects.length}.`);
  const project = object(projects[0], "Foundry project");
  const properties = object(project.properties, "project properties");
  if (properties.provisioningState !== "Succeeded") throw new Error(`Project provisioning state: ${String(properties.provisioningState)}`);
  const endpoints = object(properties.endpoints, "project endpoints");
  const endpoint = new URL(text(endpoints["AI Foundry API"], "ARM-returned Foundry project endpoint"));
  if (endpoint.protocol !== "https:" || !/^[a-z0-9-]+\.services\.ai\.azure\.com$/i.test(endpoint.hostname)
    || !/^\/api\/projects\/[^/]+\/?$/.test(endpoint.pathname) || endpoint.search || endpoint.hash
    || endpoint.port || endpoint.username || endpoint.password) {
    throw new Error("Unexpected ARM-returned project endpoint.");
  }
  const projectEndpoint = endpoint.href.replace(/\/$/, "");
  const agentUrl = `${projectEndpoint}/agents/${encodeURIComponent(agentName)}`;
  const agent = object(await request(`${agentUrl}?api-version=v1`), "agent");
  if (agent.name !== agentName) throw new Error("Remote agent name does not match the assigned name.");
  const version = object(object(agent.versions, "agent versions").latest, "latest agent version");
  const definition = object(version.definition, "agent definition");
  if (definition.kind !== "hosted") throw new Error("The deployed agent is not hosted.");
  if (!["active", "deployed"].includes(String(version.status))) throw new Error(`Hosted agent status: ${String(version.status)}`);
  const versionId = text(version.version, "agent version");
  const response = await request(`${agentUrl}/endpoint/protocols/openai/responses?api-version=v1`, "POST", {
    input: "Please greet me.", stream: false,
  });
  const greeting = responseText(response);
  if (!/\bhello[\s,!-]+world\b/i.test(greeting)) throw new Error(`Remote output is not a hello-world greeting: ${greeting.slice(0, 500)}`);
  return {
    verifiedAt: new Date().toISOString(), projectId: project.id, projectEndpoint,
    agentName, version: versionId, status: version.status, kind: definition.kind,
    input: "Please greet me.", responseId: object(response, "response").id, greeting,
  };
}
