import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";

const INTEGRATION_REPORTS_CONTAINER_NAME = "integration-reports";

const EXCLUDED_FILENAMES = new Set(["token-usage.json", "agent-metadata.json"]);

export interface BlobEntry {
    /**
     * Name of the last segment in the blob path
     */
    name: string;
    /**
     * Full blob path
     */
    blobName: string
};

/**
 * A nested tree node representing a segment of a blob path.
 * Directories have children; leaf nodes have a `blobName` pointing to the full blob path.
 */
export interface BlobTreeNode {
    /** Files directly in this path segment (leaf blobs). */
    files: BlobEntry[];
    /** Child path segments, keyed by segment name. */
    children: Record<string, BlobTreeNode>;
}

/**
 * Top-level structure: date string (yyyy-mm-dd) → nested tree of path segments.
 */
export type BlobTree = Record<string, BlobTreeNode>;

function createNode(): BlobTreeNode {
    return { files: [], children: {} };
}

export function getCredential() {
    const clientId = process.env.AZURE_CLIENT_ID;
    const isDevEnvironment = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
    return isDevEnvironment ? new AzureCliCredential() : new ManagedIdentityCredential(clientId!);
}

function getContainerClient(containerName: string): ContainerClient {
    const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
    if (!STORAGE_ACCOUNT_NAME) {
        throw new Error("STORAGE_ACCOUNT_NAME is not defined");
    }
    const blobServiceClient = new BlobServiceClient(
        `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        getCredential()
    );
    return blobServiceClient.getContainerClient(containerName);
}

function isExcluded(blobName: string): boolean {
    const filename = blobName.split("/").pop() ?? "";
    return EXCLUDED_FILENAMES.has(filename);
}

/**
 * List top-level date prefixes (yyyy-mm-dd) in a container
 * that fall within 30 days before or after today.
 */
export async function listDatePrefixes(containerClient: ContainerClient): Promise<string[]> {
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

/**
 * Enumerate all blobs in a container and categorize them
 * into a nested tree structure keyed by date at the top level.
 */
export async function enumerateBlobTree(containerClient: ContainerClient, prefix?: string): Promise<BlobTree> {
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

/**
 * Download a blob's content as a UTF-8 string.
 */
export async function downloadBlobContent(containerClient: ContainerClient, blobPath: string): Promise<string> {
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

// --- Integration-reports-specific wrappers ---

export async function listDates(): Promise<string[]> {
    return listDatePrefixes(getContainerClient(INTEGRATION_REPORTS_CONTAINER_NAME));
}

export async function enumerateBlobs(prefix?: string): Promise<BlobTree> {
    return enumerateBlobTree(getContainerClient(INTEGRATION_REPORTS_CONTAINER_NAME), prefix);
}

export async function getBlobContent(blobPath: string): Promise<string> {
    return downloadBlobContent(getContainerClient(INTEGRATION_REPORTS_CONTAINER_NAME), blobPath);
}

const azureDeploySkillName = "azure-deploy";

/**
 * @param date yyyy-mm-dd formatted date string.
 * @returns Map from run ID + skill name to full blob paths of its reports.
 */
export function getPerSkillReports(root: BlobTree, date: string): Record<string, Record<string, BlobEntry[]>> | undefined {
    const nodeAtDate = root[date];
    if (!nodeAtDate) {
        return undefined;
    }

    const result: Record<string, Record<string, BlobEntry[]>> = {};
    // non-azure-deploy
    const runIds = Object.keys(nodeAtDate.children);
    runIds.forEach((runId) => {
        const skillChildren = nodeAtDate.children[runId].children;
        const skillNames = Object.keys(skillChildren);
        skillNames.forEach((skillName) => {
            if (!result[runId]) {
                result[runId] = { [skillName]: [] };
            } else if (!result[runId][skillName]) {
                result[runId][skillName] = [];
            }
            if (skillName !== azureDeploySkillName) {
                const fileEntries = skillChildren[skillName].files;
                // Files of all test runs
                result[runId][skillName].push(...fileEntries);
                const testRunChildren = skillChildren[skillName].children;
                const testRunNames = Object.keys(testRunChildren);
                testRunNames.forEach((testRunName) => {
                    // Files of each test run
                    result[runId][skillName].push(...testRunChildren[testRunName].files);
                });
            } else {
                const groupChildren = skillChildren[skillName].children;
                const groupNames = Object.keys(groupChildren);
                groupNames.forEach((groupName) => {
                    const fileEntries = groupChildren[groupName].files;
                    // Files of all test runs in group
                    result[runId][skillName].push(...fileEntries);
                    const testRunChildren = groupChildren[groupName].children;
                    const testRunNames = Object.keys(testRunChildren);
                    testRunNames.forEach((testRunName) => {
                        // Files of each test run
                        result[runId][skillName].push(...testRunChildren[testRunName].files);
                    });
                });
            }
        });
    });

    return result;
}

const NON_INTEGRATION_CONTAINER = "non-integration";
const HEALTH_BLOB_PATH = "data/latest.json";

/**
 * Read the non-integration health dashboard blob (data/latest.json)
 * from the "non-integration" container.
 */
export async function getHealthData(): Promise<unknown> {
    const raw = await downloadBlobContent(
        getContainerClient(NON_INTEGRATION_CONTAINER),
        HEALTH_BLOB_PATH
    );
    return raw ? JSON.parse(raw) : null;
}