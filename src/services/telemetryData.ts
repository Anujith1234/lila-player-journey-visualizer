import type { Manifest, MatchTelemetry } from "../types/telemetry";

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch("/data/manifest.json");

  if (!response.ok) {
    throw new Error(`Failed to load manifest.json: ${response.status}`);
  }

  return response.json() as Promise<Manifest>;
}

export async function loadMatchTelemetry(matchFile: string): Promise<MatchTelemetry> {
  const response = await fetch(`/data/${matchFile}`);

  if (!response.ok) {
    throw new Error(`Failed to load match telemetry: ${response.status}`);
  }

  return response.json() as Promise<MatchTelemetry>;
}