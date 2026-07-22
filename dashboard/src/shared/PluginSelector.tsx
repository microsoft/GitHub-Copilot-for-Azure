import type { ChangeEvent } from "react";

export const AVAILABLE_PLUGINS = ["azure-skills", "cat"];
export const PLUGIN_SESSION_STORAGE_KEY = "dashboard.selectedPlugin";

export function getPersistedPluginSelection(): string {
    if (typeof window === "undefined") {
        return AVAILABLE_PLUGINS[0];
    }

    try {
        const persisted = window.sessionStorage.getItem(PLUGIN_SESSION_STORAGE_KEY);
        if (persisted && AVAILABLE_PLUGINS.includes(persisted)) {
            return persisted;
        }
    } catch {
        // Ignore unavailable sessionStorage and fall back to the default.
    }

    return AVAILABLE_PLUGINS[0];
}

export function persistPluginSelection(plugin: string): void {
    if (typeof window === "undefined" || !AVAILABLE_PLUGINS.includes(plugin)) {
        return;
    }

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
    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const plugin = event.target.value;
        persistPluginSelection(plugin);
        onChange(plugin);
    };

    return (
        <section className="plugin-toolbar" aria-label="Plugin selection">
            <div className="plugin-toolbar__content">
                <label className="plugin-toolbar__field">
                    <span className="plugin-toolbar__label">Plugin</span>
                    <select
                        className="plugin-toolbar__select"
                        value={selectedPlugin}
                        onChange={handleChange}
                    >
                        {AVAILABLE_PLUGINS.map((plugin) => (
                            <option key={plugin} value={plugin}>
                                {plugin}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </section>
    );
}