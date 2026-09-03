export type ClientPrincipal = {
    identityProvider: string;
    userId: string;
    userDetails: string;
    userRoles: string[];
    claims?: Array<{
        typ: string;
        val: string;
    }>;
};

/**
 * @param base64Json x-ms-client-principal header value for the user signed into the Static Web App.
 */
export function parseClientPrincipal(base64Json?: string): ClientPrincipal | undefined {
    if (base64Json === undefined) {
        return undefined;
    }

    try {
        const decodedJson = Buffer.from(base64Json, "base64").toString("utf8");
        return JSON.parse(decodedJson) as ClientPrincipal;
    } catch {
        return undefined;
    }
}

export function getTenantId(clientPrincipal: ClientPrincipal): string {
    return clientPrincipal.claims?.find(
        (claim) =>
            claim.typ === "tid" ||
            claim.typ === "http://schemas.microsoft.com/identity/claims/tenantid",
    )?.val ?? "";
}