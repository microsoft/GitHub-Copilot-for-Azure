import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

// Todo: use an env var for storage account name
const STORAGE_ACCOUNT_NAME = "skilltestreports";
const CONTAINER_NAME = "integration-reports";

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

function getContainerClient(): ContainerClient {
    const clientId = process.env.AZURE_CLIENT_ID;
    const credential = new DefaultAzureCredential(
        clientId ? { managedIdentityClientId: clientId } : undefined
    );
    const blobServiceClient = new BlobServiceClient(
        `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        credential
    );
    return blobServiceClient.getContainerClient(CONTAINER_NAME);
}

function isExcluded(blobName: string): boolean {
    const filename = blobName.split("/").pop() ?? "";
    return EXCLUDED_FILENAMES.has(filename);
}

/**
 * Enumerate all blobs in the integration-reports container and categorize them
 * into a nested tree structure keyed by date at the top level, then by each
 * subsequent path segment (RUN_ID, skill-name, test-group/test-case, etc.).
 *
 * Blobs matching excluded filenames (token-usage.json, agent-metadata.json)
 * are filtered out.
 *
 * @param prefix - Optional prefix to scope the listing (e.g. a specific date "2025-03-01/").
 * @returns A BlobTree mapping date → nested path segments → files.
 */
export async function enumerateBlobs(prefix?: string): Promise<BlobTree> {
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

        // Walk segments[1..n-1] as directory segments, place the file at the leaf.
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

/**
 * Get full content of a blob
 * @param blobPath Full blob path
 */
export async function getBlobContent(blobPath: string): Promise<string> {
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