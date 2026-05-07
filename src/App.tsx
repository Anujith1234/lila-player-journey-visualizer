import "./App.css";

function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">LILA BLACK Telemetry Tool</p>
        <h1>Player Journey Visualizer</h1>
        <p className="description">
          Browser-based tool for reviewing player movement, combat events,
          loot activity, storm deaths, and heatmap patterns across LILA BLACK maps.
        </p>

        <div className="status-grid">
          <div>
            <span>Data</span>
            <strong>Preprocessed</strong>
          </div>
          <div>
            <span>Maps</span>
            <strong>3</strong>
          </div>
          <div>
            <span>Matches</span>
            <strong>797</strong>
          </div>
          <div>
            <span>Events</span>
            <strong>89,104</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;