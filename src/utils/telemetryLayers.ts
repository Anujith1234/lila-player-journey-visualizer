import type {
  EventGroup,
  EventName,
  PlayerType,
  TelemetryPlayer,
} from "../types/telemetry";

export type MarkerKind = "loot" | "kill" | "death" | "storm_death";

export interface PathPoint {
  u: number;
  v: number;
  seq: number;
}

export interface PlayerPath {
  userId: string;
  playerType: PlayerType;
  points: PathPoint[];
}

export interface EventMarker {
  id: string;
  userId: string;
  playerType: PlayerType;
  event: EventName;
  eventGroup: EventGroup;
  kind: MarkerKind;
  t: number;
  seq: number;
  u: number;
  v: number;
  x: number;
  y: number;
  z: number;
}

export interface LayerVisibility {
  humans: boolean;
  bots: boolean;
  paths: boolean;
  loot: boolean;
  kills: boolean;
  deaths: boolean;
  stormDeaths: boolean;
}

export function isMovementEvent(event: EventName): boolean {
  return event === "Position" || event === "BotPosition";
}

export function getMarkerKind(event: EventName): MarkerKind | null {
  if (event === "Loot") return "loot";
  if (event === "Kill" || event === "BotKill") return "kill";
  if (event === "Killed" || event === "BotKilled") return "death";
  if (event === "KilledByStorm") return "storm_death";

  return null;
}

export function shouldShowPlayerType(
  playerType: PlayerType,
  visibility: LayerVisibility,
): boolean {
  if (playerType === "human") return visibility.humans;
  return visibility.bots;
}

export function shouldShowMarkerKind(
  kind: MarkerKind,
  visibility: LayerVisibility,
): boolean {
  if (kind === "loot") return visibility.loot;
  if (kind === "kill") return visibility.kills;
  if (kind === "death") return visibility.deaths;
  return visibility.stormDeaths;
}

export function buildPlayerPaths(
  players: TelemetryPlayer[],
  visibility: LayerVisibility,
  currentTimeMs?: number,
): PlayerPath[] {
  if (!visibility.paths) return [];

  return players
    .filter((player) => shouldShowPlayerType(player.playerType, visibility))
    .map((player) => {
      const points = player.events
        .filter((event) => isMovementEvent(event.event))
        .filter((event) => currentTimeMs === undefined || event.t <= currentTimeMs)
        .sort((a, b) => a.seq - b.seq)
        .map((event) => ({
          u: event.u,
          v: event.v,
          seq: event.seq,
        }));

      return {
        userId: player.userId,
        playerType: player.playerType,
        points,
      };
    })
    .filter((path) => path.points.length >= 2);
}

export function buildEventMarkers(
  players: TelemetryPlayer[],
  visibility: LayerVisibility,
  currentTimeMs?: number,
): EventMarker[] {
  const markers: EventMarker[] = [];

  for (const player of players) {
    if (!shouldShowPlayerType(player.playerType, visibility)) continue;

    for (const event of player.events) {
      if (currentTimeMs !== undefined && event.t > currentTimeMs) continue;

      const kind = getMarkerKind(event.event);
      if (!kind) continue;

      if (!shouldShowMarkerKind(kind, visibility)) continue;

      markers.push({
        id: `${player.userId}-${event.seq}-${event.event}-${event.t}`,
        userId: player.userId,
        playerType: player.playerType,
        event: event.event,
        eventGroup: event.eventGroup,
        kind,
        t: event.t,
        seq: event.seq,
        u: event.u,
        v: event.v,
        x: event.x,
        y: event.y,
        z: event.z,
      });
    }
  }

  return markers.sort((a, b) => a.seq - b.seq);
}