# LILA BLACK Player Journey Visualizer

A browser-based telemetry visualization tool for reviewing player movement, combat events, loot activity, storm deaths, and heatmap patterns across LILA BLACK match data.

The tool is designed for level designers and gameplay reviewers who need to inspect how humans and bots move through maps, where events happen, and which areas create high player activity.

## Links

- Live demo: _To be added after deployment_
- GitHub repository: _To be added before submission_

## Features

- Loads preprocessed LILA BLACK telemetry from browser-friendly JSON files.
- Supports map, date, and match filtering.
- Renders minimap-based player journeys.
- Distinguishes human and bot movement paths.
- Shows event markers for:
  - Loot
  - Kills
  - Deaths
  - Storm deaths
- Includes timeline playback with play, pause, reset, scrubbing, and playback speed controls.
- Provides heatmap overlays for:
  - Traffic
  - Kills
  - Deaths
  - Loot
  - Storm deaths
- Supports heatmap population filtering:
  - All
  - Humans
  - Bots
- Shows dataset-level summary, legend, and selected-match details.
- Generates audit and insight reports from the source telemetry.

## Tech Stack

Frontend:

- React
- TypeScript
- Vite
- CSS

Data processing:

- Python
- pandas
- pyarrow
- Pillow
- NumPy

## Project Structure

```text
lila-player-journey-visualizer/
  public/
    data/
      manifest.json
      matches/
      summaries/
    minimaps/

  reports/
    audit_summary.md
    insights_summary.json
    insights_summary.md

  scripts/
    audit_data.py
    preprocess_data.py
    generate_insights.py

  src/
    services/
      telemetryData.ts
    types/
      telemetry.ts
    utils/
      heatmap.ts
      telemetryLayers.ts
    App.tsx
    App.css
    index.css
    main.tsx

  ARCHITECTURE.md
  INSIGHTS.md
  README.md
```

## Data Pipeline

The raw telemetry files are stored locally in `raw_data/`, but that folder is intentionally ignored by Git.

The preprocessing pipeline converts the original parquet files into browser-ready JSON files under `public/data/`.

The app reads only the generated frontend data from `public/data/`.

### Main Generated Files

#### `public/data/manifest.json`

Contains dataset metadata, map configuration, minimap metadata, summary counts, and the list of available matches.

#### `public/data/matches/`

Contains one JSON file per match session. Each match file stores player-level event timelines with normalized minimap coordinates.

#### `public/data/summaries/`

Contains dataset summaries, map summaries, event summaries, and optimized heatmap cell data.

## Coordinate Mapping

World coordinates are converted into normalized minimap coordinates during preprocessing.

Each event stores:

```text
u
v
```

These are normalized values between `0` and `1`.

In the frontend, these coordinates are rendered into the SVG overlay using:

```text
x = u * 1000
y = (1 - v) * 1000
```

The Y-axis is flipped because SVG coordinates increase downward, while the normalized map coordinate system is generated from world-space map coordinates.

The audit script verifies that generated coordinates remain within valid bounds.

## Environment Variables

No environment variables are required for the current static frontend build.

## Local Setup

### 1. Install Node dependencies

```powershell
npm install
```

### 2. Start the development server

```powershell
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

```text
http://localhost:5173/
```

### 3. Build for production

```powershell
npm run build
```

### 4. Run lint checks

```powershell
npm run lint
```

## Python Environment Setup

Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

Install Python dependencies:

```powershell
pip install -r requirements.txt
```

If PowerShell blocks activation, use this for the current terminal session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
```

## Regenerating Data

### 1. Audit raw data

```powershell
python scripts\audit_data.py
```

This generates:

```text
reports/audit_report.json
reports/audit_summary.md
```

`audit_report.json` is ignored because it is a detailed generated report.  
`audit_summary.md` is committed because it is useful for reviewer validation.

### 2. Preprocess telemetry data

```powershell
python scripts\preprocess_data.py
```

This generates:

```text
public/data/manifest.json
public/data/matches/
public/data/summaries/
public/minimaps/
```

### 3. Generate insight summaries

```powershell
python scripts\generate_insights.py
```

This generates:

```text
reports/insights_summary.json
reports/insights_summary.md
```

## Current Dataset Summary

The processed dataset contains:

- Source files: 1,243
- Events: 89,104
- Match sessions: 797
- Unique players/entities: 339
- Humans: 245
- Bots: 94
- Maps: 3

Maps included:

- AmbroseValley
- GrandRift
- Lockdown

Dates included:

- February_10
- February_11
- February_12
- February_13
- February_14

## Validation Summary

The data audit confirms:

- Files readable: 1,243 / 1,243
- Bad files: 0
- Schema variants: 1
- Unknown events: None
- Unknown maps: None
- Filename mismatches: 0
- Multi-match files: 0
- Multi-map matches: 0
- Coordinates out of bounds: 0

## Product Decisions

### Match Identity

Match identity uses:

```text
date + match_id
```

instead of raw `match_id` alone, because raw match IDs can appear across different date folders. This prevents accidental merging of separate sessions.

### Heatmap Optimization

Heatmaps are generated as grid-binned cells instead of raw event points.

The frontend limits visible heatmap cells by layer and reduces rendered cells during playback. This keeps the tool responsive while still showing useful hotspots.

### Timeline Reset Behavior

The timeline resets when the selected match changes. This is intentional because each match has a different duration, event order, and player/event sequence.

### Human and Bot Separation

The app keeps human and bot controls separate because aggregate telemetry can hide differences between actual player behavior and bot pathing.

## Known Limitations

- The tool is optimized for reviewing the provided dataset, not for uploading new telemetry files in the browser.
- Some matches are very short, so timeline playback may complete quickly.
- Heatmap visibility depends on event density; sparse layers such as storm deaths may only appear in specific maps/dates.
- Large minimap images are served from the public folder and may take a moment to load on first view.

## Verification

```powershell
npm run build
npm run lint
```