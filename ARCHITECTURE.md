# Architecture

## What I Built

The Player Journey Visualizer is a static React + TypeScript web app backed by an offline Python preprocessing pipeline.

I chose this approach because the provided telemetry is file-based parquet data, while the final tool needed to be easy for a Level Designer to open in a browser. Preprocessing the data once into JSON keeps the frontend simple, fast, and deployable as a static site.

## High-Level Data Flow

```text
Raw parquet telemetry + minimap images
        |
        v
Python audit and preprocessing scripts
        |
        v
Browser-ready JSON in public/data/
        |
        v
React frontend
        |
        v
Minimap paths, markers, timeline playback, filters, and heatmaps
```

## Data Pipeline

The raw dataset is stored under `raw_data/`, which is intentionally ignored by Git. The frontend does not read parquet files directly.

The Python pipeline does four main jobs:

1. Audits the raw files for schema consistency, unknown maps/events, filename mismatches, and coordinate bounds.
2. Converts world coordinates into normalized minimap coordinates.
3. Groups telemetry into match-level JSON files using `date + match_id` as the match identity.
4. Generates frontend summary files for filtering, dataset review, and heatmap rendering.

Main generated outputs:

```text
public/data/manifest.json
public/data/matches/
public/data/summaries/
public/minimaps/
```

`manifest.json` acts as the frontend index. It contains available maps, dates, minimap metadata, map configuration, summary counts, and match file references.

## Coordinate Mapping

The tricky part of the assignment is mapping gameplay coordinates onto the correct minimap image.

During preprocessing, each event is converted from world-space coordinates into normalized minimap coordinates:

```text
u = normalized horizontal position
v = normalized vertical position
```

Both values are expected to stay between `0` and `1`.

The frontend renders these values in a fixed SVG overlay space:

```text
x = u * 1000
y = (1 - v) * 1000
```

The Y-axis is flipped because SVG coordinates increase downward, while the normalized map coordinate system is generated from world-space map coordinates.

The audit script verifies that generated coordinates stay within valid bounds. In the current processed dataset, coordinate out-of-bounds count is `0`.

## Frontend Structure

```text
src/
  services/
    telemetryData.ts       # Loads manifest, match JSON, and heatmap data

  types/
    telemetry.ts           # Shared TypeScript data contracts

  utils/
    telemetryLayers.ts     # Builds visible paths and event markers
    heatmap.ts             # Filters and normalizes heatmap cells

  App.tsx                  # Main product UI and state flow
  App.css                  # Dashboard, map, marker, timeline, and heatmap styling
```

The frontend state flow is:

```text
manifest
  -> map/date/match filters
  -> selected match JSON
  -> paths, markers, timeline playback

heatmap summary
  -> map/date/layer/player filters
  -> visible heatmap cells
```

## Rendering Model

The minimap is displayed as the base image. A square SVG overlay sits directly above it and uses the same coordinate space.

Rendering order:

1. Heatmap cells
2. Movement paths
3. Event markers

This keeps density information visible while ensuring paths and exact event markers remain readable.

Humans and bots are visually separated through different path styles. Loot, kills, deaths, and storm deaths are rendered as distinct marker types.

## Timeline Model

Each selected match has a timeline controlled by `currentTimeMs`.

Paths and markers are filtered using:

```text
event.t <= currentTimeMs
```

When the selected match changes, playback resets to the beginning. This avoids showing stale timeline positions across matches with different durations and event sequences.

## Heatmap Strategy

Heatmaps are precomputed as 64x64 grid cells during preprocessing instead of rendering every raw event point in the browser.

The frontend then applies:

- map filtering,
- date filtering,
- human/bot/all filtering,
- layer-specific cell limits,
- lower cell limits during playback,
- intensity normalization.

This keeps the heatmap useful for Level Designers while avoiding full-map visual noise and unnecessary rendering cost.

## Assumptions

| Area | Assumption / Handling |
|---|---|
| Match identity | `date + match_id` is used because raw match IDs can appear across different date folders. |
| Raw data | Raw parquet files remain local and are not committed. Generated JSON is committed for the static app. |
| Coordinate validation | Events outside valid minimap bounds would be flagged by the audit script. Current processed data has `0` out-of-bounds coordinates. |
| Timeline | Resetting playback on match change is intentional because match duration and event order differ per match. |
| Heatmaps | Heatmap density is used as a review aid, not as the only source of design conclusions. |

## Tradeoffs

| Decision | Why |
|---|---|
| Static JSON instead of backend API | Faster to build, easier to host, and enough for the provided dataset. |
| Offline preprocessing | Handles parquet parsing and coordinate normalization before the browser loads the app. |
| Precomputed heatmaps | Improves frontend responsiveness and avoids recomputing large density layers in React. |
| Single-page React app | Keeps the UX focused for Level Designers: filters, map, timeline, heatmap, and summary in one screen. |
| Fixed dataset workflow | Matches the assignment scope. The tool does not support browser-based upload of new telemetry files. |