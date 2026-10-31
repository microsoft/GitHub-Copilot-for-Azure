import { WebSiteManagementClient, type CsmUsageQuota } from "@azure/arm-appservice";
import { getCredential } from "./blobEnumerator";

const regions: string[] = [
    "southcentralus",
    "westus",
    "centralus",
    "eastus",
    "eastus2",
    "northcentralus",
];

interface AppServiceQuotaData {
    subscriptionId: string;
    scope: string;
    data: {
        region: string;
        usages: CsmUsageQuota[];
    }[];
}

export async function getAppServiceQuotas(): Promise<AppServiceQuotaData> {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID?.trim();
    if (!subscriptionId) {
        throw new Error("AZURE_SUBSCRIPTION_ID environment variable is not set");
    }

    const scope = `/subscriptions/${subscriptionId}`;
    const client = new WebSiteManagementClient(getCredential(), subscriptionId);
    const data = await Promise.all(regions.map(async (region) => {
        const usages: CsmUsageQuota[] = [];
        for await (const usage of client.getUsagesInLocation.list(region)) {
            usages.push(usage);
        }
        return {
            region,
            usages: usages.filter(usage => usage.currentValue !== undefined && usage.currentValue > 0),
        };
    }));

    return { subscriptionId, scope, data };
}
