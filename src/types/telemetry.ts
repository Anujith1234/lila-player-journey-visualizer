export type PlayerType = "human" | "bot";

export type MapId = "AmbroseValley" | "GrandRift" | "Lockdown";

export type EventName =
  | "Position"
  | "BotPosition"
  | "Kill"
  | "Killed"
  | "BotKill"
  | "BotKilled"
  | "KilledByStorm"
  | "Loot";

export type EventGroup =
  | "movement"
  | "kill"
  | "death"
  | "storm_death"
  | "loot";

export type EventCounts = Partial<Record<EventName, number>>;

export type EventGroupCounts = Partial<Record<EventGroup, number>>;

export interface MapConfig {
  scale: number;
  origin_x: number;
  origin_z: number;
  minimap: string;
}

export interface MinimapInfo {
  file: string;
  width: number;
  height: number;
}

export interface ManifestMatch {
  matchKey: string;
  matchId: string;
  matchFile: string;
  date: string;
  mapId: MapId;
  durationMs: number;
  playerCount: number;
  humanCount: number;
  botCount: number;
  eventCount: number;
  events: EventCounts;
  eventGroups: EventGroupCounts;
}

export interface Manifest {
  generatedAt: string;
  dataVersion: string;
  dates: string[];
  maps: MapId[];
  mapConfig: Record<MapId, MapConfig>;
  minimaps: Record<MapId, MinimapInfo>;
  summary: {
    filesTotal: number;
    rowsTotal: number;
    matchCount: number;
    playerCount: number;
    humanCount: number;
    botCount: number;
  };
  matches: ManifestMatch[];
}

export interface TelemetryEvent {
  t: number;
  seq: number;
  event: EventName;
  eventGroup: EventGroup;
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
}

export interface TelemetryPlayer {
  userId: string;
  playerType: PlayerType;
  eventCount: number;
  events: TelemetryEvent[];
}

export interface MatchTelemetry {
  matchKey: string;
  matchId: string;
  date: string;
  mapId: MapId;
  durationMs: number;
  summary: {
    playerCount: number;
    humanCount: number;
    botCount: number;
    eventCount: number;
    events: EventCounts;
    eventGroups: EventGroupCounts;
  };
  players: TelemetryPlayer[];
}

export type HeatmapLayer =
  | "traffic"
  | "kills"
  | "deaths"
  | "loot"
  | "stormDeaths";

export type HeatmapPlayerFilter = "all" | PlayerType;

export interface HeatmapCell {
  mapId: MapId;
  date: string;
  cellX: number;
  cellY: number;
  centerU: number;
  centerV: number;
  count: number;
}

export interface HeatmapData {
  gridSize: number;
  layers: Record<HeatmapLayer, Record<HeatmapPlayerFilter, HeatmapCell[]>>;
}