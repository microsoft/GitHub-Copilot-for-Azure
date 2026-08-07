import { type PluginSkills } from "../../api/src/blobEnumerator";
import { apiUrl } from "./apiUrl";

/**
 * Concurrent callers (e.g. the selector and a skills view mounting together)
 * share a single in-flight request so the underlying API is only hit once. 
 */
let inFlightPluginSkills: Promise<PluginSkills | null> | null = null;

async function fetchPluginSkills(): Promise<PluginSkills | null> {
    if (inFlightPluginSkills) {
        return inFlightPluginSkills;
    }

    inFlightPluginSkills = (async () => {
        const res = await fetch(apiUrl("/api/plugins"));
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = (await res.json()) as PluginSkills;
        return data;
    })();

    try {
        return await inFlightPluginSkills;
    } finally {
        inFlightPluginSkills = null;
    }
}

/**
 * Fetch the sorted list of available plugin directory names (keys of the
 * plugin-container map).
 */
export async function fetchAvailablePlugins(): Promise<string[]> {
    const pluginSkills = await fetchPluginSkills();
    return Object.keys(pluginSkills?.plugins ?? []).sort();
}

/**
 * Fetch the list of skill names that belong to the given plugin. Returns an
 * empty array when the plugin is unknown or no selection is provided.
 */
export async function fetchSkillsForPlugin(plugin: string): Promise<string[]> {
    const pluginSkills = await fetchPluginSkills();
    return pluginSkills?.plugins?.[plugin] ?? [];
}