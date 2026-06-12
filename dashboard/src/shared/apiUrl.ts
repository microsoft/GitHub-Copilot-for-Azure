/**
 * Builds an API URL by merging the page's current query parameters into the
 * given path. Path-level params take precedence over page-level params, so
 * explicit caller values are never overwritten.
 *
 * Example: page URL is /?container=abc, path is /api/dates
 * → returns /api/dates?container=abc
 *
 * Example: page URL is /?container=abc, path is /api/token-usage?skill=foo
 * → returns /api/token-usage?container=abc&skill=foo
 */
export function apiUrl(path: string): string {
    const qIdx = path.indexOf("?");
    const base = qIdx === -1 ? path : path.slice(0, qIdx);
    const existingSearch = qIdx === -1 ? "" : path.slice(qIdx + 1);

    const params = new URLSearchParams(window.location.search);

    // Path-level params override page-level params
    if (existingSearch) {
        for (const [key, value] of new URLSearchParams(existingSearch)) {
            params.set(key, value);
        }
    }

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}

/**
 * Appends the current page's `container` query parameter to a page navigation
 * URL, if one is present. Handles URLs with fragments correctly by inserting
 * the param before the `#`.
 *
 * Example: page URL is /?container=abc, path is /nightly-runs.html?date=2024-01-01#test
 * → returns /nightly-runs.html?date=2024-01-01&container=abc#test
 */
export function pageUrl(path: string): string {
    const container = new URLSearchParams(window.location.search).get("container");
    if (!container) return path;

    const hashIdx = path.indexOf("#");
    const fragment = hashIdx === -1 ? "" : path.slice(hashIdx);
    const pathWithoutFragment = hashIdx === -1 ? path : path.slice(0, hashIdx);

    const separator = pathWithoutFragment.includes("?") ? "&" : "?";
    return `${pathWithoutFragment}${separator}container=${encodeURIComponent(container)}${fragment}`;
}
