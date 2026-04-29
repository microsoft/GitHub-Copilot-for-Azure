/**
 * Shared blob-tree types used across the dashboard frontend (Vite/React),
 * the SWA API (`dashboard/api`), and the sync function app (`dashboard/sync`).
 *
 * Declared as `.d.ts` so the file emits no JS and does not participate in
 * the per-project `rootDir` restriction. Consumers import via relative path.
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
