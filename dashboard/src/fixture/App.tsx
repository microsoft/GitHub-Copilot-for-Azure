import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../shared/apiUrl";

interface FixtureResourceGroup {
    id: string;
    name: string;
    type: string;
    location: string;
    subscriptionId: string;
    tags: Record<string, string>;
}

interface ExpectedFixture {
    fixtureId: string;
    fixtureVersion: number;
}

interface FixtureManifest {
    id: string;
    fixtures: ExpectedFixture[];
}

interface FixtureResponse {
    data: FixtureResourceGroup[];
    fixtureManifests: FixtureManifest[];
}

interface ManifestGroup {
    manifestId: string;
    isInManifest: boolean;
    resourceGroups: FixtureResourceGroup[];
    missingFixtures: ExpectedFixture[];
}

const MISSING_MANIFEST_ID = "No ManifestId";

function completedStatusClass(value: string | undefined): string {
    if (value?.toLowerCase() === "true") return "fixture-completed fixture-completed-true";
    if (value?.toLowerCase() === "false") return "fixture-completed fixture-completed-false";
    return "fixture-completed";
}

function formatDeleteAfter(value: string): string {
    const match = value.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
    );
    if (!match) {
        return value;
    }

    const [, month, day, year, hour, minute, second] = match;
    const utcDate = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    ));

    if (
        utcDate.getUTCFullYear() !== Number(year)
        || utcDate.getUTCMonth() !== Number(month) - 1
        || utcDate.getUTCDate() !== Number(day)
        || utcDate.getUTCHours() !== Number(hour)
        || utcDate.getUTCMinutes() !== Number(minute)
        || utcDate.getUTCSeconds() !== Number(second)
    ) {
        return value;
    }

    return utcDate.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFixtureResponse(value: unknown): FixtureResponse {
    if (
        !isRecord(value)
        || !Array.isArray(value.data)
        || !Array.isArray(value.fixtureManifests)
    ) {
        throw new Error("The fixture API returned an unexpected response");
    }

    const data = value.data.map((entry, index) => {
        if (
            !isRecord(entry)
            || typeof entry.id !== "string"
            || typeof entry.name !== "string"
            || typeof entry.type !== "string"
            || typeof entry.location !== "string"
            || typeof entry.subscriptionId !== "string"
            || !isRecord(entry.tags)
            || typeof entry.tags.FixtureId !== "string"
            || !entry.tags.FixtureId
            || Object.values(entry.tags).some((tagValue) => typeof tagValue !== "string")
        ) {
            throw new Error(`The fixture API returned an invalid resource group at index ${index}`);
        }

        return {
            id: entry.id,
            name: entry.name,
            type: entry.type,
            location: entry.location,
            subscriptionId: entry.subscriptionId,
            tags: entry.tags as Record<string, string>,
        };
    });

    const fixtureManifests = value.fixtureManifests.map((manifest, manifestIndex) => {
        if (
            !isRecord(manifest)
            || typeof manifest.id !== "string"
            || !manifest.id
            || !Array.isArray(manifest.fixtures)
        ) {
            throw new Error(`The fixture API returned an invalid manifest at index ${manifestIndex}`);
        }

        const fixtures = manifest.fixtures.map((fixture, fixtureIndex) => {
            if (
                !isRecord(fixture)
                || typeof fixture.fixtureId !== "string"
                || !fixture.fixtureId
                || !Number.isInteger(fixture.fixtureVersion)
            ) {
                throw new Error(
                    `The fixture API returned an invalid fixture at manifest index ${manifestIndex}, fixture index ${fixtureIndex}`,
                );
            }
            return {
                fixtureId: fixture.fixtureId,
                fixtureVersion: fixture.fixtureVersion as number,
            };
        });

        return { id: manifest.id, fixtures };
    });

    return { data, fixtureManifests };
}

export default function App() {
    const [resourceGroups, setResourceGroups] = useState<FixtureResourceGroup[]>([]);
    const [fixtureManifests, setFixtureManifests] = useState<FixtureManifest[]>([]);
    const [selectedResourceGroup, setSelectedResourceGroup] = useState<FixtureResourceGroup | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const controller = new AbortController();

        const loadFixtureData = async () => {
            try {
                const result = await fetch(apiUrl("/api/fixture-data"), {
                    signal: controller.signal,
                });
                if (!result.ok) {
                    throw new Error(`API error: ${result.status}`);
                }

                const data: unknown = await result.json();
                const fixtureResponse = parseFixtureResponse(data);
                setResourceGroups(fixtureResponse.data);
                setFixtureManifests(fixtureResponse.fixtureManifests);
            } catch (loadError: unknown) {
                if (loadError instanceof DOMException && loadError.name === "AbortError") {
                    return;
                }
                setError(loadError instanceof Error ? loadError.message : String(loadError));
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void loadFixtureData();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!selectedResourceGroup) {
            return;
        }

        closeButtonRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setSelectedResourceGroup(null);
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [selectedResourceGroup]);

    const manifestGroups = useMemo<ManifestGroup[]>(() => {
        const groups = new Map<string, {
            isInManifest: boolean;
            resourceGroups: FixtureResourceGroup[];
            expectedFixtures: ExpectedFixture[];
        }>();

        for (const manifest of fixtureManifests) {
            groups.set(manifest.id, {
                isInManifest: true,
                resourceGroups: [],
                expectedFixtures: manifest.fixtures,
            });
        }

        for (const resourceGroup of resourceGroups) {
            const manifestId = resourceGroup.tags.ManifestId || MISSING_MANIFEST_ID;
            const group = groups.get(manifestId) ?? {
                isInManifest: false,
                resourceGroups: [],
                expectedFixtures: [],
            };
            group.resourceGroups.push(resourceGroup);
            groups.set(manifestId, group);
        }

        return [...groups.entries()]
            .map(([manifestId, group]) => {
                const discoveredFixtureKeys = new Set(
                    group.resourceGroups.map(
                        (resourceGroup) =>
                            `${resourceGroup.tags.FixtureId}\0${resourceGroup.tags.FixtureVersion}`,
                    ),
                );
                return {
                    manifestId,
                    isInManifest: group.isInManifest,
                    resourceGroups: group.resourceGroups.sort((left, right) => left.name.localeCompare(right.name)),
                    missingFixtures: group.expectedFixtures.filter(
                        (fixture) =>
                            !discoveredFixtureKeys.has(`${fixture.fixtureId}\0${fixture.fixtureVersion}`),
                    ),
                };
            })
            .sort((left, right) => {
                if (left.manifestId === MISSING_MANIFEST_ID) return 1;
                if (right.manifestId === MISSING_MANIFEST_ID) return -1;
                return left.manifestId.localeCompare(right.manifestId);
            });
    }, [fixtureManifests, resourceGroups]);

    const missingFixtureCount = manifestGroups.reduce(
        (total, group) => total + group.missingFixtures.length,
        0,
    );

    const sortedSelectedTags = selectedResourceGroup
        ? Object.entries(selectedResourceGroup.tags).sort(([left], [right]) => left.localeCompare(right))
        : [];

    return (
        <div className="pd-dashboard" id="main">
            <header className="pd-header fixture-header">
                <h1>Fixture</h1>
                {!loading && !error && (
                    <p>
                        {manifestGroups.length} manifest {manifestGroups.length === 1 ? "group" : "groups"} containing{" "}
                        {resourceGroups.length} discovered resource {resourceGroups.length === 1 ? "group" : "groups"}
                        {missingFixtureCount > 0 && `; ${missingFixtureCount} expected missing`}
                    </p>
                )}
            </header>

            {error && <p className="pd-error">Error: {error}</p>}

            {loading ? (
                <p className="pd-loading">Loading fixture data…</p>
            ) : !error && manifestGroups.length === 0 ? (
                <p className="pd-empty">No fixture resource groups were found.</p>
            ) : !error ? (
                <div className="fixture-groups">
                    {manifestGroups.map((group) => (
                        <section className="fixture-group" key={group.manifestId}>
                            <header className="fixture-group-header">
                                <div>
                                    <div className="fixture-group-heading-labels">
                                        <span className="fixture-group-label">Manifest ID</span>
                                        {!group.isInManifest && (
                                            <span className="fixture-group-count fixture-group-count-missing">
                                                Not in manifest
                                            </span>
                                        )}
                                    </div>
                                    <h2>{group.manifestId}</h2>
                                </div>
                                <div className="fixture-group-summary">
                                    <span className="fixture-group-count">
                                        {group.resourceGroups.length} discovered
                                    </span>
                                    {group.missingFixtures.length > 0 && (
                                        <span className="fixture-group-count fixture-group-count-missing">
                                            {group.missingFixtures.length} missing
                                        </span>
                                    )}
                                </div>
                            </header>

                            <div className="fixture-resource-list">
                                {group.resourceGroups.map((resourceGroup) => (
                                    <button
                                        type="button"
                                        className="fixture-resource-card"
                                        key={resourceGroup.id}
                                        onClick={() => setSelectedResourceGroup(resourceGroup)}
                                        aria-label={`View details for ${resourceGroup.name}`}
                                    >
                                        <span className="fixture-resource-name">{resourceGroup.name}</span>
                                        <span className="fixture-resource-meta">
                                            <span>Fixture: {resourceGroup.tags.FixtureId}</span>
                                            <span>{resourceGroup.location}</span>
                                            <span className={completedStatusClass(resourceGroup.tags.Completed)}>
                                                Completed: {resourceGroup.tags.Completed ?? "Not set"}
                                            </span>
                                            <span>Fixture version: {resourceGroup.tags.FixtureVersion ?? "Not set"}</span>
                                            {resourceGroup.tags.DeleteAfter ? (
                                                <span>Delete after: {formatDeleteAfter(resourceGroup.tags.DeleteAfter)}</span>
                                            ) : resourceGroup.tags.DoNotDelete ? (
                                                <span>Do not delete: {resourceGroup.tags.DoNotDelete}</span>
                                            ) : null}
                                            <span>{Object.keys(resourceGroup.tags).length} tags</span>
                                        </span>
                                        <span className="fixture-resource-action">View details</span>
                                    </button>
                                ))}
                                {group.missingFixtures.map((fixture) => (
                                    <div
                                        className="fixture-resource-card fixture-resource-missing"
                                        key={`missing:${fixture.fixtureId}:${fixture.fixtureVersion}`}
                                        role="status"
                                    >
                                        <span className="fixture-resource-name">Expected fixture missing</span>
                                        <span className="fixture-resource-meta">
                                            <span>Fixture: {fixture.fixtureId}</span>
                                            <span>Fixture version: {fixture.fixtureVersion}</span>
                                        </span>
                                        <span className="fixture-missing-label">Missing</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : null}

            {selectedResourceGroup && (
                <div
                    className="fixture-panel-backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setSelectedResourceGroup(null);
                        }
                    }}
                >
                    <aside
                        className="fixture-details-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="fixture-details-heading"
                    >
                        <header className="fixture-details-header">
                            <div>
                                <span className="fixture-group-label">Resource group</span>
                                <h2 id="fixture-details-heading">{selectedResourceGroup.name}</h2>
                            </div>
                            <button
                                ref={closeButtonRef}
                                type="button"
                                className="fixture-close-button"
                                onClick={() => setSelectedResourceGroup(null)}
                                aria-label="Close resource group details"
                            >
                                Close
                            </button>
                        </header>

                        <dl className="fixture-details-list">
                            <div>
                                <dt>Fixture ID</dt>
                                <dd>{selectedResourceGroup.tags.FixtureId}</dd>
                            </div>
                            <div>
                                <dt>Name</dt>
                                <dd>{selectedResourceGroup.name}</dd>
                            </div>
                            <div>
                                <dt>Location</dt>
                                <dd>{selectedResourceGroup.location}</dd>
                            </div>
                            <div>
                                <dt>Subscription ID</dt>
                                <dd>{selectedResourceGroup.subscriptionId}</dd>
                            </div>
                            <div>
                                <dt>Type</dt>
                                <dd>{selectedResourceGroup.type}</dd>
                            </div>
                            <div>
                                <dt>Resource ID</dt>
                                <dd>{selectedResourceGroup.id}</dd>
                            </div>
                        </dl>

                        <section className="fixture-tags" aria-labelledby="fixture-tags-heading">
                            <h3 id="fixture-tags-heading">Tags ({sortedSelectedTags.length})</h3>
                            <dl>
                                {sortedSelectedTags.map(([name, value]) => (
                                    <div key={name}>
                                        <dt>{name}</dt>
                                        <dd>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    </aside>
                </div>
            )}
        </div>
    );
}
