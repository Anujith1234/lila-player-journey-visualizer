import type { Manifest } from "../types/telemetry";

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch("/data/manifest.json");

  if (!response.ok) {
    throw new Error(`Failed to load manifest.json: ${response.status}`);
  }

  return response.json() as Promise<Manifest>;
}