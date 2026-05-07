import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { loadManifest } from "./services/telemetryData";
import type { Manifest, ManifestMatch, MapId } from "./types/telemetry";

function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapId | "all">("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [selectedMatchKey, setSelectedMatchKey] = useState<string>("");

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
    if (!manifest) return null;

    return (
      manifest.matches.find((match) => match.matchKey === selectedMatchKey) ??
      filteredMatches[0] ??
      null
    );
  }, [manifest, selectedMatchKey, filteredMatches]);

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

        <div className="map-placeholder">
          <div>
            <p className="eyebrow">Map Workspace</p>
            <h3>Telemetry review canvas</h3>
            <p>
              Select a map, date, and match to inspect player journeys, combat activity,
              loot behavior, storm deaths, and heatmap patterns on the minimap.
            </p>
          </div>
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