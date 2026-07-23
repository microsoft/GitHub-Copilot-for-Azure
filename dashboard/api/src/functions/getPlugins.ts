import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPluginSkills } from "../blobEnumerator";

/**
 * Returns the map of plugin names to their skill names,
 * GET /api/plugins
 */
async function getPluginsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const pluginSkills = await getPluginSkills();
        return {
            status: 200,
            jsonBody: pluginSkills,
        };
    } catch (err) {
        context.error("Failed to read plugin containers:", err);
        return { status: 500, body: "Failed to read plugin containers" };
    }
}

app.http("getPlugins", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "plugins",
    handler: getPluginsHandler,
});
