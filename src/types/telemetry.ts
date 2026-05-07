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
  events: Partial<Record<EventName, number>>;
  eventGroups: Partial<Record<EventGroup, number>>;
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