/**
 * Blob-tree types used by the sync function app (`dashboard/sync`).
 *
 * Note: This file is duplicated across `dashboard/src/shared`,
 * `dashboard/api/src/shared`, and `dashboard/sync/src/shared` so each
 * sub-project can compile under its own `rootDir`. Keep them in sync.
 *
 * WARNING: Do NOT consolidate these interfaces into a single file at the
 * root of the project. Each sub-project (root, api/, sync/) has its own
 * tsconfig with a scoped `rootDir`, and the deployment-time build will
 * fail if a shared file lives outside the sub-project's source tree.
 */

export interface BlobEntry {
    /** Name of the last segment in the blob path. */
    name: string;
    /** Full blob path. */
    blobName: string;
}

/**
 * A nested tree node representing a segment of a blob path.
 * Directories have children; leaf entries live in `files`.
 */
export interface BlobTreeNode {
    /** Files directly in this path segment (leaf blobs). */
    files: BlobEntry[];
    /** Child path segments, keyed by segment name. */
    children: Record<string, BlobTreeNode>;
}

/**
 * Top-level structure: date string (yyyy-mm-dd) -> nested tree of path segments.
 */
export type BlobTree = Record<string, BlobTreeNode>;
