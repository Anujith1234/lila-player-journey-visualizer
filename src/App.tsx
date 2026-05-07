import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadManifest, loadMatchTelemetry } from "./services/telemetryData";
import type {
  Manifest,
  ManifestMatch,
  MapId,
  MatchTelemetry,
} from "./types/telemetry";
import {
  buildEventMarkers,
  buildPlayerPaths,
  type LayerVisibility,
} from "./utils/telemetryLayers";


function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapId | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedMatchKey, setSelectedMatchKey] = useState<string>("");
  const [matchTelemetry, setMatchTelemetry] = useState<MatchTelemetry | null>(null);
  const [matchLoadError, setMatchLoadError] = useState<string | null>(null);
  const [isMatchLoading, setIsMatchLoading] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    humans: true,
    bots: true,
    paths: true,
    loot: true,
    kills: true,
    deaths: true,
    stormDeaths: true,
  });

  function toggleLayer(layer: keyof LayerVisibility) {
    setLayerVisibility((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }

  useEffect(() => {
    loadManifest()
      .then((data) => {
        setManifest(data);

        if (data.matches.length > 0) {
          setSelectedMatchKey(data.matches[0].matchKey);
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown data loading error";
        setLoadError(message);
      });
  }, []);

  const filteredMatches = useMemo(() => {
    if (!manifest) return [];

    return manifest.matches.filter((match) => {
      const mapMatches = selectedMap === "all" || match.mapId === selectedMap;
      const dateMatches = selectedDate === "all" || match.date === selectedDate;
      return mapMatches && dateMatches;
    });
  }, [manifest, selectedMap, selectedDate]);

  const selectedMatch = useMemo<ManifestMatch | null>(() => {
    if (!manifest || filteredMatches.length === 0) return null;

    return (
      filteredMatches.find((match) => match.matchKey === selectedMatchKey) ??
      filteredMatches[0]
    );
  }, [manifest, filteredMatches, selectedMatchKey]);

  useEffect(() => {
    if (filteredMatches.length === 0) {
      setSelectedMatchKey("");
      return;
    }

    const stillAvailable = filteredMatches.some(
      (match) => match.matchKey === selectedMatchKey,
    );

    if (!stillAvailable) {
      setSelectedMatchKey(filteredMatches[0].matchKey);
    }
  }, [filteredMatches, selectedMatchKey]);

  useEffect(() => {
    if (!selectedMatch) {
      setMatchTelemetry(null);
      setMatchLoadError(null);
      setIsMatchLoading(false);
      return;
    }

    let isCancelled = false;

    setIsMatchLoading(true);
    setMatchLoadError(null);
    setMatchTelemetry(null);

    loadMatchTelemetry(selectedMatch.matchFile)
      .then((data) => {
        if (!isCancelled) {
          setMatchTelemetry(data);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          const message =
            error instanceof Error ? error.message : "Unknown match loading error";
          setMatchLoadError(message);
          setMatchTelemetry(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsMatchLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedMatch]);

  const visiblePaths = useMemo(() => {
    if (!matchTelemetry) return [];
    return buildPlayerPaths(matchTelemetry.players, layerVisibility);
  }, [matchTelemetry, layerVisibility]);

  const visibleMarkers = useMemo(() => {
    if (!matchTelemetry) return [];
    return buildEventMarkers(matchTelemetry.players, layerVisibility);
  }, [matchTelemetry, layerVisibility]);

  if (loadError) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="error-panel">
          <p className="eyebrow">Data Load Error</p>
          <h1>Could not load telemetry data</h1>
          <p>{loadError}</p>
        </section>
      </main>
    );
  }

  if (!manifest) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="hero-panel">
          <p className="eyebrow">LILA BLACK Telemetry Tool</p>
          <h1>Loading telemetry data…</h1>
          <p className="description">
            Preparing match metadata, map filters, and dataset summaries.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="tool-shell">
      <aside className="sidebar panel">
        <div>
          <p className="eyebrow">LILA BLACK</p>
          <h1>Player Journey Visualizer</h1>
          <p className="sidebar-description">
            Explore player movement, combat, loot activity, storm deaths, and heatmap
            patterns across the provided LILA BLACK telemetry.
          </p>
        </div>

        <label className="field">
          <span>Map</span>
          <select
            value={selectedMap}
            onChange={(event) => setSelectedMap(event.target.value as MapId | "all")}
          >
            <option value="all">All maps</option>
            {manifest.maps.map((mapId) => (
              <option key={mapId} value={mapId}>
                {mapId}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Date</span>
          <select
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          >
            <option value="all">All dates</option>
            {manifest.dates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Match</span>
          <select
            value={selectedMatch?.matchKey ?? ""}
            onChange={(event) => setSelectedMatchKey(event.target.value)}
            disabled={filteredMatches.length === 0}
          >
            {filteredMatches.length === 0 ? (
              <option>No matches available</option>
            ) : (
              filteredMatches.map((match) => (
                <option key={match.matchKey} value={match.matchKey}>
                  {match.date} · {match.mapId} · {match.eventCount} events
                </option>
              ))
            )}
          </select>
        </label>

        <div className="small-stat">
          <span>Filtered matches</span>
          <strong>{filteredMatches.length}</strong>
        </div>

        <div className="layer-panel">
          <p className="eyebrow">Layers</p>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.humans}
              onChange={() => toggleLayer("humans")}
            />
            <span>Humans</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.bots}
              onChange={() => toggleLayer("bots")}
            />
            <span>Bots</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.paths}
              onChange={() => toggleLayer("paths")}
            />
            <span>Movement paths</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.loot}
              onChange={() => toggleLayer("loot")}
            />
            <span>Loot markers</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.kills}
              onChange={() => toggleLayer("kills")}
            />
            <span>Kill markers</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.deaths}
              onChange={() => toggleLayer("deaths")}
            />
            <span>Death markers</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={layerVisibility.stormDeaths}
              onChange={() => toggleLayer("stormDeaths")}
            />
            <span>Storm deaths</span>
          </label>
        </div>
      </aside>

      <section className="main-panel panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Map Review</p>
            <h2>{selectedMatch ? selectedMatch.mapId : "No match selected"}</h2>
          </div>

          {selectedMatch && (
            <div className="match-pill">
              {selectedMatch.date} · {selectedMatch.eventCount.toLocaleString()} events
            </div>
          )}
        </div>

        <div className="map-workspace">
          {selectedMatch ? (
            <>
              {manifest.minimaps[selectedMatch.mapId] ? (
                <div className="map-frame">
                  <img
                    className="minimap-image"
                    src={`/minimaps/${manifest.minimaps[selectedMatch.mapId].file}`}
                    alt={`${selectedMatch.mapId} minimap`}
                  />

                  <svg
                    className="telemetry-overlay"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    aria-label="Telemetry overlay"
                  >
                    {visiblePaths.map((path) => (
                      <polyline
                        key={path.userId}
                        className={`player-path player-path--${path.playerType}`}
                        points={path.points
                          .map(
                            (point) =>
                              `${point.u * 1000},${(1 - point.v) * 1000}`,
                          )
                          .join(" ")}
                      />
                    ))}

                    {visibleMarkers.map((marker) => (
                      <circle
                        key={marker.id}
                        className={`event-marker event-marker--${marker.kind} event-marker--${marker.playerType}`}
                        cx={marker.u * 1000}
                        cy={(1 - marker.v) * 1000}
                        r={marker.kind === "storm_death" ? 8 : 6}
                      >
                        <title>
                          {`${marker.event} · ${
                            marker.playerType
                          } · x:${marker.x.toFixed(1)}, z:${marker.z.toFixed(1)}`}
                        </title>
                      </circle>
                    ))}
                  </svg>

                  <div className="map-status-overlay">
                    {isMatchLoading && <span>Loading selected match…</span>}

                    {matchLoadError && (
                      <span className="error-text">{matchLoadError}</span>
                    )}

                    {!isMatchLoading && !matchLoadError && matchTelemetry && (
                      <div className="map-status-card">
                        <strong>{visiblePaths.length}</strong> paths ·{" "}
                        <strong>{visibleMarkers.length}</strong> markers
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="map-placeholder">
                  <div>
                    <p className="eyebrow">Map Asset Missing</p>
                    <h3>Minimap not found</h3>
                    <p>
                      The selected match references {selectedMatch.mapId}, but the
                      minimap entry is not available in the manifest.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="map-placeholder">
              <div>
                <p className="eyebrow">Map Workspace</p>
                <h3>No match selected</h3>
                <p>
                  Select a map, date, and match to inspect telemetry on the minimap.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="summary-panel panel">
        <p className="eyebrow">Dataset Summary</p>

        <div className="summary-grid">
          <div>
            <span>Matches</span>
            <strong>{manifest.summary.matchCount.toLocaleString()}</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>{manifest.summary.rowsTotal.toLocaleString()}</strong>
          </div>
          <div>
            <span>Players</span>
            <strong>{manifest.summary.playerCount.toLocaleString()}</strong>
          </div>
          <div>
            <span>Humans</span>
            <strong>{manifest.summary.humanCount.toLocaleString()}</strong>
          </div>
          <div>
            <span>Bots</span>
            <strong>{manifest.summary.botCount.toLocaleString()}</strong>
          </div>
          <div>
            <span>Maps</span>
            <strong>{manifest.maps.length}</strong>
          </div>
        </div>

        <div className="legend-card">
          <p className="eyebrow">Legend</p>
          <div className="legend-list">
            <span>
              <i className="legend-line legend-line--human" /> Human path
            </span>
            <span>
              <i className="legend-line legend-line--bot" /> Bot path
            </span>
            <span>
              <i className="legend-dot legend-dot--loot" /> Loot
            </span>
            <span>
              <i className="legend-dot legend-dot--kill" /> Kill
            </span>
            <span>
              <i className="legend-dot legend-dot--death" /> Death
            </span>
            <span>
              <i className="legend-dot legend-dot--storm" /> Storm death
            </span>
          </div>
        </div>
        
        <div className="selected-card">
          <p className="eyebrow">Selected Match</p>
          {selectedMatch ? (
            <>
              <h3>{selectedMatch.mapId}</h3>
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{selectedMatch.date}</dd>
                </div>
                <div>
                  <dt>Players</dt>
                  <dd>{selectedMatch.playerCount}</dd>
                </div>
                <div>
                  <dt>Humans</dt>
                  <dd>{selectedMatch.humanCount}</dd>
                </div>
                <div>
                  <dt>Bots</dt>
                  <dd>{selectedMatch.botCount}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{selectedMatch.eventCount.toLocaleString()}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>No match selected.</p>
          )}
        </div>
      </aside>
    </main>
  );
}

export default App;