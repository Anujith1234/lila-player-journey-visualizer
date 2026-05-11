import type {
  HeatmapData,
  Manifest,
  MatchTelemetry,
} from "../types/telemetry";

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to load ${label}: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export function loadManifest(): Promise<Manifest> {
  return fetchJson<Manifest>("/data/manifest.json", "manifest.json");
}

export function loadMatchTelemetry(matchFile: string): Promise<MatchTelemetry> {
  return fetchJson<MatchTelemetry>(
    `/data/${matchFile}`,
    "match telemetry",
  );
}

export function loadHeatmapData(): Promise<HeatmapData> {
  return fetchJson<HeatmapData>(
    "/data/summaries/heatmap_points.json",
    "heatmap data",
  );
}