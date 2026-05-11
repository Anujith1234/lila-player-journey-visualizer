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

interface HeatmapCellLimit {
  default: number;
  playback: number;
  minIntensity: number;
}

const HEATMAP_CELL_LIMITS: Record<HeatmapLayer, HeatmapCellLimit> = {
  traffic: {
    default: 650,
    playback: 320,
    minIntensity: 0.16,
  },
  kills: {
    default: 900,
    playback: 500,
    minIntensity: 0.04,
  },
  deaths: {
    default: 900,
    playback: 500,
    minIntensity: 0.04,
  },
  loot: {
    default: 700,
    playback: 400,
    minIntensity: 0.08,
  },
  stormDeaths: {
    default: 300,
    playback: 200,
    minIntensity: 0,
  },
};

function sortHeatmapCells(a: HeatmapCell, b: HeatmapCell): number {
  return (
    b.count - a.count ||
    a.mapId.localeCompare(b.mapId) ||
    a.date.localeCompare(b.date) ||
    a.cellX - b.cellX ||
    a.cellY - b.cellY
  );
}

export function getVisibleHeatmapCells(
  heatmapData: HeatmapData | null,
  layer: HeatmapLayer,
  playerFilter: HeatmapPlayerFilter,
  mapId: MapId,
  date: string | "all",
  isPlaybackActive = false,
): VisibleHeatmapCell[] {
  if (!heatmapData) return [];

  const layerCells = heatmapData.layers[layer]?.[playerFilter] ?? [];
  const layerLimits = HEATMAP_CELL_LIMITS[layer];

  const matchingCells = layerCells.filter((cell) => {
    const mapMatches = cell.mapId === mapId;
    const dateMatches = date === "all" || cell.date === date;

    return mapMatches && dateMatches;
  });

  const maxVisibleCells = isPlaybackActive
    ? layerLimits.playback
    : layerLimits.default;

  const strongestCells = [...matchingCells]
    .sort(sortHeatmapCells)
    .slice(0, maxVisibleCells);

  const maxCount = strongestCells.reduce(
    (currentMax, cell) => Math.max(currentMax, cell.count),
    0,
  );

  if (maxCount === 0) return [];

  return strongestCells
    .map((cell) => ({
      ...cell,
      intensity: cell.count / maxCount,
    }))
    .filter((cell) => cell.intensity >= layerLimits.minIntensity);
}

export function getHeatmapLabel(layer: HeatmapLayer): string {
  if (layer === "traffic") return "Traffic";
  if (layer === "kills") return "Kills";
  if (layer === "deaths") return "Deaths";
  if (layer === "loot") return "Loot";

  return "Storm deaths";
}