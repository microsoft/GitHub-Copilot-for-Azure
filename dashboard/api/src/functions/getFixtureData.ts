import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { QueryRequest, ResourceGraphClient } from "@azure/arm-resourcegraph";
import { AzureCliCredential, ManagedIdentityCredential, TokenCredential } from "@azure/identity";
import { getFixtureManifests } from "../blobEnumerator";
import { validateRequestIdentity } from "../requestIdentity";

const FIXTURE_QUERY = `
ResourceContainers
| where type =~ "microsoft.resources/subscriptions/resourcegroups"
| where isnotempty(tags["FixtureId"])
| where tostring(properties.provisioningState) !~ "Deleting"
| project id, name, type, location, subscriptionId, tags
| order by id asc
`.trim();
const PAGE_SIZE = 1000;

function getCredential(): TokenCredential {
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development") {
        return new AzureCliCredential();
    }

    const clientId = process.env.AZURE_CLIENT_ID;
    return clientId ? new ManagedIdentityCredential(clientId) : new ManagedIdentityCredential();
}

function getSubscriptionIds(): string[] {
    const subscriptionIds = process.env.AZURE_SUBSCRIPTION_IDS
        ?.split(",")
        .map((subscriptionId) => subscriptionId.trim())
        .filter(Boolean);

    if (!subscriptionIds?.length) {
        throw new Error("AZURE_SUBSCRIPTION_IDS environment variable is not set");
    }
    return subscriptionIds;
}

async function getFixtureData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const unauthorizedResponse = validateRequestIdentity(request, context, "getFixtureData");
    if (unauthorizedResponse) {
        return unauthorizedResponse;
    }

    try {
        const fixtureManifestInventory = await getFixtureManifests();
        if (!fixtureManifestInventory || !Array.isArray(fixtureManifestInventory.fixtureManifests)) {
            throw new Error("Fixture manifest inventory is unavailable or invalid");
        }

        const client = new ResourceGraphClient(getCredential());
        const subscriptions = getSubscriptionIds();
        const data: unknown[] = [];
        const seenSkipTokens = new Set<string>();
        let skipToken: string | undefined;

        do {
            const query: QueryRequest = {
                subscriptions,
                query: FIXTURE_QUERY,
                options: {
                    resultFormat: "objectArray",
                    top: PAGE_SIZE,
                    skipToken,
                },
            };
            const page = await client.resources(query);
            if (!Array.isArray(page.data)) {
                throw new Error("Azure Resource Graph returned an unexpected result format");
            }

            data.push(...page.data);
            skipToken = page.skipToken;
            if (skipToken && seenSkipTokens.has(skipToken)) {
                throw new Error("Azure Resource Graph returned a repeated continuation token");
            }
            if (skipToken) {
                seenSkipTokens.add(skipToken);
            }
        } while (skipToken);

        return {
            status: 200,
            jsonBody: {
                totalRecords: data.length,
                count: data.length,
                resultTruncated: "false",
                data,
                fixtureManifests: fixtureManifestInventory.fixtureManifests,
            },
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        context.error("Failed to load fixture data:", message);
        return {
            status: 500,
            jsonBody: { error: "Failed to load fixture data" },
        };
    }
}

app.http("getFixtureData", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "fixture-data",
    handler: getFixtureData,
});