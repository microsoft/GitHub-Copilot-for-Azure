import { useEffect, useState, type ChangeEvent } from "react";
import { fetchAvailablePlugins } from "./plugins";
import { getPersistedPluginSelection, persistPluginSelection } from "./apiUrl";

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