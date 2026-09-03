import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { parseClientPrincipal } from "../shared/clientPrincipal";

/**
 * Returns the user principal supplied by Static Web Apps authentication.
 * GET /api/getUser
 */
async function getUser(
    request: HttpRequest,
    _context: InvocationContext,
): Promise<HttpResponseInit> {
    const clientPrincipal = parseClientPrincipal(
        request.headers.get("x-ms-client-principal") ?? undefined,
    );

    if (!clientPrincipal) {
        return {
            status: 401,
            jsonBody: { error: "Unauthorized" },
        };
    }

    return {
        status: 200,
        jsonBody: clientPrincipal,
    };
}

app.http("getUser", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "getUser",
    handler: getUser,
});