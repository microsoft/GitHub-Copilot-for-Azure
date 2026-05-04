import { HttpRequest, InvocationContext } from "@azure/functions";

interface StaticWebAppClaim {
    typ: string;
    val: string;
}

interface StaticWebAppClientPrincipal {
    identityProvider?: string;
    userId?: string;
    userDetails?: string;
    userRoles?: string[];
    claims?: StaticWebAppClaim[];
}

interface RequestIdentity {
    authSource: "static-web-apps" | "easy-auth" | "unknown";
    identityProvider?: string;
    userId?: string;
    userDetails?: string;
    userRoles?: string[];
}

function parseStaticWebAppPrincipal(request: HttpRequest): StaticWebAppClientPrincipal | undefined {
    const encodedPrincipal = request.headers.get("x-ms-client-principal");
    if (!encodedPrincipal) {
        return undefined;
    }

    try {
        const decodedPrincipal = Buffer.from(encodedPrincipal, "base64").toString("utf8");
        return JSON.parse(decodedPrincipal) as StaticWebAppClientPrincipal;
    } catch {
        return undefined;
    }
}

function getRequestIdentity(request: HttpRequest): RequestIdentity {
    const staticWebAppPrincipal = parseStaticWebAppPrincipal(request);
    if (staticWebAppPrincipal) {
        return {
            authSource: "static-web-apps",
            identityProvider: staticWebAppPrincipal.identityProvider,
            userId: staticWebAppPrincipal.userId,
            userDetails: staticWebAppPrincipal.userDetails,
            userRoles: staticWebAppPrincipal.userRoles,
        };
    }

    const easyAuthUserId = request.headers.get("x-ms-client-principal-id") ?? undefined;
    const easyAuthUserDetails = request.headers.get("x-ms-client-principal-name") ?? undefined;
    const easyAuthIdentityProvider = request.headers.get("x-ms-client-principal-idp") ?? undefined;

    if (easyAuthUserId || easyAuthUserDetails || easyAuthIdentityProvider) {
        return {
            authSource: "easy-auth",
            identityProvider: easyAuthIdentityProvider,
            userId: easyAuthUserId,
            userDetails: easyAuthUserDetails,
        };
    }

    return { authSource: "unknown" };
}

export function logRequestIdentity(
    request: HttpRequest,
    context: InvocationContext,
    apiName: string,
): void {
    const identity = getRequestIdentity(request);

    context.log(
        JSON.stringify({
            eventName: "api_request_identity",
            apiName,
            invocationId: context.invocationId,
            method: request.method,
            url: request.url,
            authSource: identity.authSource,
            identityProvider: identity.identityProvider,
            userId: identity.userId,
            userDetails: identity.userDetails,
            userRoles: identity.userRoles,
        }),
    );
}