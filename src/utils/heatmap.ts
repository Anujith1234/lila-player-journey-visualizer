import type {
  HeatmapCell,
  HeatmapData,
  HeatmapLayer,
  HeatmapPlayerFilter,
  MapId,
} from "../types/telemetry";

export interface VisibleHeatmapCell extends HeatmapCell {
  intensity: number;
}

const MAX_VISIBLE_HEATMAP_CELLS = 1200;
const MAX_PLAYBACK_HEATMAP_CELLS = 500;

export function getVisibleHeatmapCells(
  heatmapData: HeatmapData | null,
  layer: HeatmapLayer,
  playerFilter: HeatmapPlayerFilter,
  mapId: MapId,
  date: string | "all",
  isPlaybackActive = false,
): VisibleHeatmapCell[] {
  if (!heatmapData) return [];

  const cells = heatmapData.layers[layer][playerFilter].filter((cell) => {
    const mapMatches = cell.mapId === mapId;
    const dateMatches = date === "all" || cell.date === date;
    return mapMatches && dateMatches;
  });

  const maxVisibleCells = isPlaybackActive
    ? MAX_PLAYBACK_HEATMAP_CELLS
    : MAX_VISIBLE_HEATMAP_CELLS;

  const strongestCells = [...cells]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxVisibleCells);

  const maxCount = strongestCells.reduce(
    (currentMax, cell) => Math.max(currentMax, cell.count),
    0,
  );

  if (maxCount === 0) return [];

  return strongestCells.map((cell) => ({
    ...cell,
    intensity: cell.count / maxCount,
  }));
}

export function getHeatmapLabel(layer: HeatmapLayer): string {
  if (layer === "traffic") return "Traffic";
  if (layer === "kills") return "Kills";
  if (layer === "deaths") return "Deaths";
  if (layer === "loot") return "Loot";
  return "Storm deaths";
}