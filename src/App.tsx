import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  loadHeatmapData,
  loadManifest,
  loadMatchTelemetry,
} from "./services/telemetryData";
import type {
  HeatmapData,
  HeatmapLayer,
  HeatmapPlayerFilter,
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
import {
  getHeatmapLabel,
  getVisibleHeatmapCells,
} from "./utils/heatmap";

const PLAYBACK_TIME_SCALE = 0.2;

function getHeatmapOpacity(layer: HeatmapLayer, intensity: number): number {
  if (layer === "traffic") return 0.035 + intensity * 0.26;
  if (layer === "loot") return 0.05 + intensity * 0.34;
  if (layer === "kills") return 0.08 + intensity * 0.42;
  if (layer === "deaths") return 0.08 + intensity * 0.42;

  return 0.12 + intensity * 0.5;
}

function formatTimelineTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(milliseconds % 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${Math.floor(
    millis / 100,
  )}`;
}

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
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [heatmapLoadError, setHeatmapLoadError] = useState<string | null>(null);
  const [selectedHeatmapLayer, setSelectedHeatmapLayer] =
    useState<HeatmapLayer>("traffic");
  const [heatmapPlayerFilter, setHeatmapPlayerFilter] =
    useState<HeatmapPlayerFilter>("all");
  const [showHeatmap, setShowHeatmap] = useState(false);

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

  useEffect(() => {
    loadHeatmapData()
      .then((data) => {
        setHeatmapData(data);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown heatmap loading error";
        setHeatmapLoadError(message);
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
    setCurrentTimeMs(0);
    setIsPlaying(false);

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

  const timelineMaxMs = matchTelemetry?.durationMs ?? selectedMatch?.durationMs ?? 0;

  const visiblePaths = useMemo(() => {
    if (!matchTelemetry) return [];
    return buildPlayerPaths(matchTelemetry.players, layerVisibility, currentTimeMs);
  }, [matchTelemetry, layerVisibility, currentTimeMs]);

  const visibleMarkers = useMemo(() => {
    if (!matchTelemetry) return [];
    return buildEventMarkers(matchTelemetry.players, layerVisibility, currentTimeMs);
  }, [matchTelemetry, layerVisibility, currentTimeMs]);

  const visibleHeatmapCells = useMemo(() => {
    if (!selectedMatch) return [];

    return getVisibleHeatmapCells(
      heatmapData,
      selectedHeatmapLayer,
      heatmapPlayerFilter,
      selectedMatch.mapId,
      selectedDate,
      isPlaying,
    );
  }, [
    heatmapData,
    heatmapPlayerFilter,
    isPlaying,
    selectedDate,
    selectedHeatmapLayer,
    selectedMatch,
  ]);

  useEffect(() => {
    if (!isPlaying || !matchTelemetry) return;

    const interval = window.setInterval(() => {
      setCurrentTimeMs((current) => {
        const next = current + 16 * playbackSpeed * PLAYBACK_TIME_SCALE;

        if (next >= timelineMaxMs) {
          setIsPlaying(false);
          return timelineMaxMs;
        }

        return next;
      });
    }, 16);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying, matchTelemetry, playbackSpeed, timelineMaxMs]);

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

        <div className="layer-panel">
          <p className="eyebrow">Heatmap</p>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={() => setShowHeatmap((current) => !current)}
            />
            <span>Show heatmap overlay</span>
          </label>

          <label className="field">
            <span>Heatmap layer</span>
            <select
              value={selectedHeatmapLayer}
              onChange={(event) =>
                setSelectedHeatmapLayer(event.target.value as HeatmapLayer)
              }
              disabled={!showHeatmap}
            >
              <option value="traffic">Traffic</option>
              <option value="kills">Kills</option>
              <option value="deaths">Deaths</option>
              <option value="loot">Loot</option>
              <option value="stormDeaths">Storm deaths</option>
            </select>
          </label>

          <label className="field">
            <span>Players</span>
            <select
              value={heatmapPlayerFilter}
              onChange={(event) =>
                setHeatmapPlayerFilter(event.target.value as HeatmapPlayerFilter)
              }
              disabled={!showHeatmap}
            >
              <option value="all">All</option>
              <option value="human">Humans</option>
              <option value="bot">Bots</option>
            </select>
          </label>

          {heatmapLoadError && (
            <p className="panel-warning">{heatmapLoadError}</p>
          )}
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

                    {showHeatmap &&
                      heatmapData &&
                      visibleHeatmapCells.map((cell) => (
                        <rect
                          key={`${cell.mapId}-${cell.date}-${selectedHeatmapLayer}-${heatmapPlayerFilter}-${cell.cellX}-${cell.cellY}`}
                          className={`heatmap-cell heatmap-cell--${selectedHeatmapLayer}`}
                          x={(cell.cellX / heatmapData.gridSize) * 1000}
                          y={
                            ((heatmapData.gridSize - cell.cellY - 1) /
                              heatmapData.gridSize) *
                            1000
                          }
                          width={1000 / heatmapData.gridSize}
                          height={1000 / heatmapData.gridSize}
                          opacity={getHeatmapOpacity(
                            selectedHeatmapLayer,
                            cell.intensity,
                          )}
                        />
                      ))}

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
                        <strong>{visiblePaths.length}</strong> active paths ·{" "}
                        <strong>{visibleMarkers.length}</strong> markers
                        {showHeatmap && (
                          <>
                            {" "}· <strong>{visibleHeatmapCells.length}</strong>{" "}
                            {getHeatmapLabel(selectedHeatmapLayer).toLowerCase()} cells
                          </>
                        )}
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

        <div className="timeline-panel">
          <div className="timeline-header">
            <div>
              <p className="eyebrow">Timeline</p>
              <strong>
                {formatTimelineTime(currentTimeMs)} /{" "}
                {formatTimelineTime(timelineMaxMs)}
              </strong>
            </div>

            <div className="timeline-actions">
              <button
                type="button"
                onClick={() => {
                  if (!isPlaying && currentTimeMs >= timelineMaxMs) {
                    setCurrentTimeMs(0);
                  }

                  setIsPlaying((current) => !current);
                }}
                disabled={!matchTelemetry || timelineMaxMs <= 0}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTimeMs(0);
                  setIsPlaying(false);
                }}
                disabled={!matchTelemetry}
              >
                Reset
              </button>

              <select
                value={playbackSpeed}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                disabled={!matchTelemetry}
                aria-label="Playback speed"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </div>

          <input
            className="timeline-slider"
            type="range"
            min={0}
            max={Math.max(timelineMaxMs, 1)}
            step={1}
            value={Math.min(currentTimeMs, Math.max(timelineMaxMs, 1))}
            onChange={(event) => {
              setCurrentTimeMs(Number(event.target.value));
              setIsPlaying(false);
            }}
            disabled={!matchTelemetry}
          />
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
            <span>
              <i className="legend-heatmap" /> Heatmap intensity
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