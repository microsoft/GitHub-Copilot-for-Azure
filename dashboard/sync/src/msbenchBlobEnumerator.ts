import { BlobServiceClient } from "@azure/storage-blob";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";

export interface BlobEntry {
    name: string;
    blobName: string;
}

export interface BlobTreeNode {
    files: BlobEntry[];
    children: Record<string, BlobTreeNode>;
}

export type BlobTree = Record<string, BlobTreeNode>;

const MSBENCH_STORAGE_ACCOUNT = process.env.MSBENCH_STORAGE_ACCOUNT;
const MSBENCH_REPORTS_CONTAINER_NAME = process.env.MSBENCH_REPORTS_CONTAINER;

const EXCLUDED_FILENAMES = new Set(["token-usage.json", "agent-metadata.json"]);

function getContainerClient() {
    if (!MSBENCH_STORAGE_ACCOUNT) {
        throw new Error("MSBENCH_STORAGE_ACCOUNT environment variable is not set");
    }
    if (!MSBENCH_REPORTS_CONTAINER_NAME) {
        throw new Error("MSBENCH_REPORTS_CONTAINER environment variable is not set");
    }
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    const credential = isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
    const blobServiceClient = new BlobServiceClient(
        `https://${MSBENCH_STORAGE_ACCOUNT}.blob.core.windows.net`,
        credential
    );
    return blobServiceClient.getContainerClient(MSBENCH_REPORTS_CONTAINER_NAME);
}

function isExcluded(blobName: string): boolean {
    const filename = blobName.split("/").pop() ?? "";
    return EXCLUDED_FILENAMES.has(filename);
}

function createNode(): BlobTreeNode {
    return { files: [], children: {} };
}

export async function listMsbenchDates(): Promise<string[]> {
    const containerClient = getContainerClient();
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const minDate = new Date(now.getTime() - 30 * msPerDay);
    const maxDate = new Date(now.getTime() + 30 * msPerDay);

    const dates: string[] = [];

    for await (const item of containerClient.listBlobsByHierarchy("/")) {
        if (item.kind === "prefix" && item.name) {
            const dateStr = item.name.replace(/\/$/, "");
            const parsed = new Date(dateStr + "T00:00:00");
            if (!isNaN(parsed.getTime()) && parsed >= minDate && parsed <= maxDate) {
                dates.push(dateStr);
            }
        }
    }

    return dates.sort().reverse();
}

export async function enumerateMsbenchBlobs(prefix?: string): Promise<BlobTree> {
    const containerClient = getContainerClient();
    const tree: BlobTree = {};

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (isExcluded(blob.name)) {
            continue;
        }

        const segments = blob.name.split("/");
        if (segments.length < 2) {
            continue;
        }

        const date = segments[0];
        if (!tree[date]) {
            tree[date] = createNode();
        }

        let current = tree[date];
        for (let i = 1; i < segments.length - 1; i++) {
            const seg = segments[i];
            if (!current.children[seg]) {
                current.children[seg] = createNode();
            }
            current = current.children[seg];
        }

        const fileName = segments[segments.length - 1];
        current.files.push({ name: fileName, blobName: blob.name });
    }

    return tree;
}

export async function getMsbenchBlobContent(blobPath: string): Promise<string> {
    const containerClient = getContainerClient();
    const blobClient = containerClient.getBlobClient(blobPath);
    const response = await blobClient.download();
    if (!response.readableStreamBody) {
        return "";
    }
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
}
