import { type PluginSkills } from "../../api/src/blobEnumerator";
import { useEffect, useState, type ChangeEvent } from "react";
import { apiUrl } from "./apiUrl";

export const PLUGIN_SESSION_STORAGE_KEY = "dashboard.selectedPlugin";
export const PLUGIN_SKILLS_SESSION_STORAGE_KEY = "dashboard.pluginSkills";

function getCachedPluginSkills(): PluginSkills | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(PLUGIN_SKILLS_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed;
    } catch {
        return null;
    }
}

function cachePluginSkills(data: PluginSkills): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.setItem(PLUGIN_SKILLS_SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Ignore unavailable sessionStorage; the map will simply be re-fetched.
    }
}

/**
 * Concurrent callers (e.g. the selector and a skills view mounting together)
 * share a single in-flight request so the underlying API is only hit once. 
 */
let inFlightPluginSkills: Promise<PluginSkills | null> | null = null;

async function fetchPluginSkills(): Promise<PluginSkills | null> {
    const cached = getCachedPluginSkills();
    if (cached) {
        return cached;
    }

    if (inFlightPluginSkills) {
        return inFlightPluginSkills;
    }

    inFlightPluginSkills = (async () => {
        const res = await fetch(apiUrl("/api/plugins"));
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = (await res.json()) as PluginSkills;
        cachePluginSkills(data);
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

export function getPersistedPluginSelection(): string {
    try {
        return window.sessionStorage.getItem(PLUGIN_SESSION_STORAGE_KEY) ?? "";
    } catch {
        // Ignore unavailable sessionStorage and fall back to no selection.
        return "";
    }
}

export function persistPluginSelection(plugin: string): void {
    try {
        window.sessionStorage.setItem(PLUGIN_SESSION_STORAGE_KEY, plugin);
    } catch {
        // Ignore unavailable sessionStorage; the UI can still function locally.
    }
}

interface PluginSelectorProps {
    selectedPlugin: string;
    onChange: (plugin: string) => void;
}

export default function PluginSelector({ selectedPlugin, onChange }: PluginSelectorProps) {
    const [plugins, setPlugins] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const list = await fetchAvailablePlugins();
                if (cancelled) return;
                setPlugins(list);
                // Ensure the active selection is valid for the fetched list,
                // preferring the persisted value before the first plugin.
                if (list.length > 0 && !list.includes(selectedPlugin)) {
                    const persisted = getPersistedPluginSelection();
                    const next = list.includes(persisted) ? persisted : list[0];
                    persistPluginSelection(next);
                    onChange(next);
                }
            } catch {
                // Leave the list empty; the selector renders in a disabled state.
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const plugin = event.target.value;
        persistPluginSelection(plugin);
        onChange(plugin);
    };

    // While the list loads, keep the persisted selection selectable so the
    // controlled <select> always has a matching option.
    const options =
        plugins.length > 0 ? plugins : selectedPlugin ? [selectedPlugin] : [];

    return (
        <section className="plugin-toolbar" aria-label="Plugin selection">
            <div className="plugin-toolbar__content">
                <label className="plugin-toolbar__field">
                    <span className="plugin-toolbar__label">Plugin</span>
                    <select
                        className="plugin-toolbar__select"
                        value={selectedPlugin}
                        onChange={handleChange}
                        disabled={plugins.length === 0}
                    >
                        {options.length === 0 ? (
                            <option value="">Loading…</option>
                        ) : (
                            options.map((plugin) => (
                                <option key={plugin} value={plugin}>
                                    {plugin}
                                </option>
                            ))
                        )}
                    </select>
                </label>
            </div>
        </section>
    );
}