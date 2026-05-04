import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { BlobTree, listDatePrefixes, enumerateBlobTree, downloadBlobContent, getCredential } from "./blobEnumerator";

const MSBENCH_STORAGE_ACCOUNT = process.env.MSBENCH_STORAGE_ACCOUNT;
const MSBENCH_REPORTS_CONTAINER_NAME = process.env.MSBENCH_REPORTS_CONTAINER;

function getContainerClient() {
    if (!MSBENCH_STORAGE_ACCOUNT) {
        throw new Error("MSBENCH_STORAGE_ACCOUNT environment variable is not set");
    }
    if (!MSBENCH_REPORTS_CONTAINER_NAME) {
        throw new Error("MSBENCH_REPORTS_CONTAINER environment variable is not set");
    }
    const blobServiceClient = new BlobServiceClient(
        `https://${MSBENCH_STORAGE_ACCOUNT}.blob.core.windows.net`,
        getCredential()
    );
    return blobServiceClient.getContainerClient(MSBENCH_REPORTS_CONTAINER_NAME);
}

async function hasReportBlobs(containerClient: ContainerClient, datePrefix: string): Promise<boolean> {
    for await (const blob of containerClient.listBlobsFlat({ prefix: datePrefix + "/" })) {
        if (blob.name.endsWith(".md")) {
            return true;
        }
    }
    return false;
}

export async function listMsbenchDates(): Promise<string[]> {
    const containerClient = getContainerClient();
    const allDates = await listDatePrefixes(containerClient);
    const results = await Promise.all(
        allDates.map(async (date) => ({ date, hasReports: await hasReportBlobs(containerClient, date) }))
    );
    return results.filter((r) => r.hasReports).map((r) => r.date);
}

export async function enumerateMsbenchBlobs(prefix?: string): Promise<BlobTree> {
    return enumerateBlobTree(getContainerClient(), prefix);
}

export async function getMsbenchBlobContent(blobPath: string): Promise<string> {
    return downloadBlobContent(getContainerClient(), blobPath);
}
