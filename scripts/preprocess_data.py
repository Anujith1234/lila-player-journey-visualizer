import json
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image


RAW_DATA_DIR = Path("raw_data/player_data")
PUBLIC_DIR = Path("public")
PUBLIC_DATA_DIR = PUBLIC_DIR / "data"
PUBLIC_MATCHES_DIR = PUBLIC_DATA_DIR / "matches"
PUBLIC_SUMMARIES_DIR = PUBLIC_DATA_DIR / "summaries"
PUBLIC_MINIMAPS_DIR = PUBLIC_DIR / "minimaps"


REQUIRED_COLUMNS = ["user_id", "match_id", "map_id", "x", "y", "z", "ts", "event"]

EXPECTED_EVENTS = {
    "Position",
    "BotPosition",
    "Kill",
    "Killed",
    "BotKill",
    "BotKilled",
    "KilledByStorm",
    "Loot",
}

MAP_CONFIG = {
    "AmbroseValley": {
        "scale": 900,
        "origin_x": -370,
        "origin_z": -473,
        "minimap": "AmbroseValley_Minimap.png",
    },
    "GrandRift": {
        "scale": 581,
        "origin_x": -290,
        "origin_z": -290,
        "minimap": "GrandRift_Minimap.png",
    },
    "Lockdown": {
        "scale": 1000,
        "origin_x": -500,
        "origin_z": -500,
        "minimap": "Lockdown_Minimap.jpg",
    },
}


UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def is_human_user_id(user_id: str) -> bool:
    return bool(UUID_PATTERN.match(str(user_id)))


def get_player_type(user_id: str) -> str:
    return "human" if is_human_user_id(user_id) else "bot"


def decode_event(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def classify_event_group(event: str) -> str:
    if event in {"Position", "BotPosition"}:
        return "movement"
    if event in {"Kill", "BotKill"}:
        return "kill"
    if event in {"Killed", "BotKilled"}:
        return "death"
    if event == "KilledByStorm":
        return "storm_death"
    if event == "Loot":
        return "loot"
    return "unknown"


def safe_match_filename(date: str, match_id: str) -> str:
    """
    Convert a date + match ID into a URL-safe JSON filename.

    match_id alone is not guaranteed to be globally unique across all date folders,
    so the date is included in the generated filename.
    """
    safe_match_id = match_id.replace(".nakama-0", "_nakama-0")
    return f"{date}__{safe_match_id}.json"


def build_match_key(date: str, match_id: str) -> str:
    """
    Stable frontend key for one match instance in the dataset.
    """
    return f"{date}__{match_id}"


def world_to_uv(map_id: str, x: float, z: float):
    config = MAP_CONFIG[map_id]
    u = (x - config["origin_x"]) / config["scale"]
    v = (z - config["origin_z"]) / config["scale"]
    return float(u), float(v)


def ensure_clean_output_dirs():
    """
    Clean generated frontend data while keeping the folder structure predictable.
    This prevents stale match JSON files from remaining after reruns.
    """
    if PUBLIC_DATA_DIR.exists():
        shutil.rmtree(PUBLIC_DATA_DIR)

    if PUBLIC_MINIMAPS_DIR.exists():
        shutil.rmtree(PUBLIC_MINIMAPS_DIR)

    PUBLIC_MATCHES_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_MINIMAPS_DIR.mkdir(parents=True, exist_ok=True)


def copy_minimaps():
    source_minimap_dir = RAW_DATA_DIR / "minimaps"

    if not source_minimap_dir.exists():
        raise FileNotFoundError("raw_data/player_data/minimaps folder not found.")

    copied = {}

    for map_id, config in MAP_CONFIG.items():
        source = source_minimap_dir / config["minimap"]
        destination = PUBLIC_MINIMAPS_DIR / config["minimap"]

        if not source.exists():
            raise FileNotFoundError(f"Missing minimap image: {source}")

        shutil.copy2(source, destination)

        with Image.open(destination) as image:
            copied[map_id] = {
                "file": config["minimap"],
                "width": image.width,
                "height": image.height,
            }

    return copied


def load_raw_rows():
    """
    Read all parquet journey files and return one combined dataframe.
    Date is taken from the folder name because ts is match-context time,
    not wall-clock date.
    """
    if not RAW_DATA_DIR.exists():
        raise FileNotFoundError("raw_data/player_data does not exist.")

    date_folders = sorted(
        folder
        for folder in RAW_DATA_DIR.iterdir()
        if folder.is_dir() and folder.name.startswith("February_")
    )

    if not date_folders:
        raise RuntimeError("No February_* folders found in raw_data/player_data.")

    frames = []
    files_total = 0

    for date_folder in date_folders:
        parquet_files = [
            file
            for file in date_folder.iterdir()
            if file.is_file() and not file.name.startswith(".")
        ]

        for file_path in parquet_files:
            files_total += 1

            table = pq.read_table(file_path)
            df = table.to_pandas()

            missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
            if missing_columns:
                raise ValueError(f"{file_path} missing required columns: {missing_columns}")

            df["date"] = date_folder.name
            df["source_file"] = file_path.name
            frames.append(df)

    if not frames:
        raise RuntimeError("No parquet rows were loaded.")

    combined = pd.concat(frames, ignore_index=True)

    combined["user_id"] = combined["user_id"].astype(str)
    combined["match_id"] = combined["match_id"].astype(str)
    combined["map_id"] = combined["map_id"].astype(str)
    combined["event"] = combined["event"].apply(decode_event)
    combined["event_group"] = combined["event"].apply(classify_event_group)
    combined["player_type"] = combined["user_id"].apply(get_player_type)

    unknown_events = sorted(set(combined["event"]) - EXPECTED_EVENTS)
    if unknown_events:
        raise ValueError(f"Unknown event types found: {unknown_events}")

    unknown_maps = sorted(set(combined["map_id"]) - set(MAP_CONFIG.keys()))
    if unknown_maps:
        raise ValueError(f"Unknown map IDs found: {unknown_maps}")

    combined["ts"] = pd.to_datetime(combined["ts"])

    uv_values = combined.apply(
        lambda row: world_to_uv(row["map_id"], row["x"], row["z"]),
        axis=1,
        result_type="expand",
    )

    combined["u"] = uv_values[0]
    combined["v"] = uv_values[1]

    out_of_bounds = combined[
        (combined["u"] < 0)
        | (combined["u"] > 1)
        | (combined["v"] < 0)
        | (combined["v"] > 1)
    ]

    if len(out_of_bounds) > 0:
        raise ValueError(f"Found {len(out_of_bounds)} out-of-bounds coordinates.")

    return combined, files_total


def counter_to_dict(counter: Counter):
    return dict(counter)


def build_heatmap_points(df: pd.DataFrame, grid_size: int = 64):
    """
    Build grid-binned heatmap data instead of exporting every raw point.

    The frontend can render each cell as a heatmap/density square or use the
    cell center as a weighted heatmap point. This keeps the deployed JSON small
    and fast while still preserving the level-design value of the heatmap.

    Coordinates:
    - u/v are normalized 0-1 map coordinates.
    - cellX/cellY are grid positions from 0 to grid_size - 1.
    - centerU/centerV are the center positions of each grid cell.
    """

    heatmap = {
        "gridSize": grid_size,
        "layers": {
            "traffic": {"all": [], "human": [], "bot": []},
            "kills": {"all": [], "human": [], "bot": []},
            "deaths": {"all": [], "human": [], "bot": []},
            "loot": {"all": [], "human": [], "bot": []},
            "stormDeaths": {"all": [], "human": [], "bot": []},
        },
    }

    layer_rules = {
        "traffic": {"Position", "BotPosition"},
        "kills": {"Kill", "BotKill"},
        "deaths": {"Killed", "BotKilled"},
        "loot": {"Loot"},
        "stormDeaths": {"KilledByStorm"},
    }

    # Store counts by layer -> player type -> map/date/cell.
    bins = {
        layer_name: {
            "all": Counter(),
            "human": Counter(),
            "bot": Counter(),
        }
        for layer_name in layer_rules
    }

    for _, row in df.iterrows():
        event = row["event"]
        player_type = row["player_type"]

        # Clamp to avoid u/v == 1 producing cell index == grid_size.
        cell_x = min(grid_size - 1, max(0, int(float(row["u"]) * grid_size)))
        cell_y = min(grid_size - 1, max(0, int(float(row["v"]) * grid_size)))

        for layer_name, events in layer_rules.items():
            if event in events:
                key = (row["map_id"], row["date"], cell_x, cell_y)
                bins[layer_name]["all"][key] += 1
                bins[layer_name][player_type][key] += 1

    for layer_name, player_groups in bins.items():
        for player_type, counter in player_groups.items():
            cells = []

            for (map_id, date, cell_x, cell_y), count in counter.items():
                cells.append(
                    {
                        "mapId": map_id,
                        "date": date,
                        "cellX": int(cell_x),
                        "cellY": int(cell_y),
                        "centerU": round((cell_x + 0.5) / grid_size, 6),
                        "centerV": round((cell_y + 0.5) / grid_size, 6),
                        "count": int(count),
                    }
                )

            cells.sort(
                key=lambda item: (
                    item["mapId"],
                    item["date"],
                    item["cellX"],
                    item["cellY"],
                )
            )

            heatmap["layers"][layer_name][player_type] = cells

    return heatmap

def build_dataset_summary(df: pd.DataFrame, files_total: int, minimap_info: dict):
    rows_by_date = Counter(df["date"])
    rows_by_map = Counter(df["map_id"])
    rows_by_event = Counter(df["event"])
    rows_by_event_group = Counter(df["event_group"])
    rows_by_player_type = Counter(df["player_type"])

    unique_players = set(df["user_id"])
    unique_humans = set(df[df["player_type"] == "human"]["user_id"])
    unique_bots = set(df[df["player_type"] == "bot"]["user_id"])
    unique_matches = df.groupby(["date", "match_id"]).ngroups

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "filesTotal": files_total,
            "rowsTotal": int(len(df)),
            "dateRange": ["February_10", "February_14"],
            "maps": sorted(MAP_CONFIG.keys()),
        },
        "counts": {
            "uniquePlayers": len(unique_players),
            "uniqueHumans": len(unique_humans),
            "uniqueBots": len(unique_bots),
            "uniqueMatches": int(unique_matches),
        },
        "rowsByDate": counter_to_dict(rows_by_date),
        "rowsByMap": counter_to_dict(rows_by_map),
        "rowsByEvent": counter_to_dict(rows_by_event),
        "rowsByEventGroup": counter_to_dict(rows_by_event_group),
        "rowsByPlayerType": counter_to_dict(rows_by_player_type),
        "minimaps": minimap_info,
    }


def build_map_summary(df: pd.DataFrame):
    summary = {}

    for map_id, group in df.groupby("map_id"):
        human_rows = group[group["player_type"] == "human"]
        bot_rows = group[group["player_type"] == "bot"]

        summary[map_id] = {
            "rowCount": int(len(group)),
            "matchCount": int(group.groupby(["date", "match_id"]).ngroups),
            "playerCount": int(group["user_id"].nunique()),
            "humanRowCount": int(len(human_rows)),
            "botRowCount": int(len(bot_rows)),
            "eventCounts": counter_to_dict(Counter(group["event"])),
            "eventGroupCounts": counter_to_dict(Counter(group["event_group"])),
            "bounds": {
                "xMin": float(group["x"].min()),
                "xMax": float(group["x"].max()),
                "zMin": float(group["z"].min()),
                "zMax": float(group["z"].max()),
                "uMin": float(group["u"].min()),
                "uMax": float(group["u"].max()),
                "vMin": float(group["v"].min()),
                "vMax": float(group["v"].max()),
            },
        }

    return summary


def build_event_summary(df: pd.DataFrame):
    events_by_date = {}
    events_by_map = {}
    events_by_player_type = {}

    for date, group in df.groupby("date"):
        events_by_date[date] = counter_to_dict(Counter(group["event"]))

    for map_id, group in df.groupby("map_id"):
        events_by_map[map_id] = counter_to_dict(Counter(group["event"]))

    for player_type, group in df.groupby("player_type"):
        events_by_player_type[player_type] = counter_to_dict(Counter(group["event"]))

    return {
        "eventsByDate": events_by_date,
        "eventsByMap": events_by_map,
        "eventsByPlayerType": events_by_player_type,
        "eventGroups": counter_to_dict(Counter(df["event_group"])),
    }


def build_match_json(date: str, match_id: str, match_group: pd.DataFrame):
    match_group = match_group.sort_values(["ts", "user_id", "event"]).copy()

    map_ids = sorted(match_group["map_id"].unique())
    dates = sorted(match_group["date"].unique())

    if len(map_ids) != 1:
        raise ValueError(f"Match {match_id} on {date} contains multiple maps: {map_ids}")

    if len(dates) != 1:
        raise ValueError(
            f"Internal grouping error: expected one date for {match_id}, got {dates}"
        )

    map_id = map_ids[0]
    date = dates[0]
    match_key = build_match_key(date, match_id)

    min_ts = match_group["ts"].min()
    max_ts = match_group["ts"].max()
    duration_ms = int((max_ts - min_ts).total_seconds() * 1000)

    match_group["t"] = (
        (match_group["ts"] - min_ts).dt.total_seconds() * 1000
    ).astype(int)

    match_group["seq"] = range(len(match_group))

    players = []

    for user_id, player_group in match_group.groupby("user_id"):
        player_group = player_group.sort_values(["ts", "seq"])

        player_type = get_player_type(user_id)

        player_events = []
        for _, row in player_group.iterrows():
            player_events.append(
                {
                    "t": int(row["t"]),
                    "seq": int(row["seq"]),
                    "event": row["event"],
                    "eventGroup": row["event_group"],
                    "x": round(float(row["x"]), 4),
                    "y": round(float(row["y"]), 4),
                    "z": round(float(row["z"]), 4),
                    "u": round(float(row["u"]), 6),
                    "v": round(float(row["v"]), 6),
                }
            )

        players.append(
            {
                "userId": user_id,
                "playerType": player_type,
                "eventCount": int(len(player_events)),
                "events": player_events,
            }
        )

    players.sort(key=lambda player: (player["playerType"], player["userId"]))

    event_counts = Counter(match_group["event"])
    event_group_counts = Counter(match_group["event_group"])

    human_count = sum(1 for player in players if player["playerType"] == "human")
    bot_count = sum(1 for player in players if player["playerType"] == "bot")

    return {
        "matchKey": match_key,
        "matchId": match_id,
        "date": date,
        "mapId": map_id,
        "durationMs": duration_ms,
        "summary": {
            "playerCount": len(players),
            "humanCount": human_count,
            "botCount": bot_count,
            "eventCount": int(len(match_group)),
            "events": counter_to_dict(event_counts),
            "eventGroups": counter_to_dict(event_group_counts),
        },
        "players": players,
    }


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def main():
    print("\nPREPROCESSING LILA TELEMETRY DATA")
    print("=" * 70)

    ensure_clean_output_dirs()

    print("Copying minimap images...")
    minimap_info = copy_minimaps()

    print("Loading raw parquet files...")
    df, files_total = load_raw_rows()

    print(f"Loaded files: {files_total}")
    print(f"Loaded rows:  {len(df)}")

    print("Building summaries...")
    dataset_summary = build_dataset_summary(df, files_total, minimap_info)
    map_summary = build_map_summary(df)
    event_summary = build_event_summary(df)
    heatmap_points = build_heatmap_points(df)

    write_json(PUBLIC_SUMMARIES_DIR / "dataset_summary.json", dataset_summary)
    write_json(PUBLIC_SUMMARIES_DIR / "map_summary.json", map_summary)
    write_json(PUBLIC_SUMMARIES_DIR / "event_summary.json", event_summary)
    write_json(PUBLIC_SUMMARIES_DIR / "heatmap_points.json", heatmap_points)

    print("Writing match JSON files...")

    manifest_matches = []

    for (date, match_id), match_group in df.groupby(["date", "match_id"]):
        match_data = build_match_json(date, match_id, match_group)
        match_filename = safe_match_filename(date, match_id)
        match_path = PUBLIC_MATCHES_DIR / match_filename

        write_json(match_path, match_data)

        manifest_matches.append(
            {
                "matchKey": match_data["matchKey"],
                "matchId": match_id,
                "matchFile": f"matches/{match_filename}",
                "date": match_data["date"],
                "mapId": match_data["mapId"],
                "durationMs": match_data["durationMs"],
                "playerCount": match_data["summary"]["playerCount"],
                "humanCount": match_data["summary"]["humanCount"],
                "botCount": match_data["summary"]["botCount"],
                "eventCount": match_data["summary"]["eventCount"],
                "events": match_data["summary"]["events"],
                "eventGroups": match_data["summary"]["eventGroups"],
            }
        )

    manifest_matches.sort(
        key=lambda item: (
            item["mapId"],
            item["date"],
            -item["eventCount"],
            item["matchId"],
        )
    )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataVersion": "phase-2-preprocessed",
        "dates": sorted(df["date"].unique()),
        "maps": sorted(df["map_id"].unique()),
        "mapConfig": MAP_CONFIG,
        "minimaps": minimap_info,
        "summary": {
            "filesTotal": files_total,
            "rowsTotal": int(len(df)),
            "matchCount": int(df.groupby(["date", "match_id"]).ngroups),
            "playerCount": int(df["user_id"].nunique()),
            "humanCount": int(df[df["player_type"] == "human"]["user_id"].nunique()),
            "botCount": int(df[df["player_type"] == "bot"]["user_id"].nunique()),
        },
        "matches": manifest_matches,
    }

    write_json(PUBLIC_DATA_DIR / "manifest.json", manifest)

    print("\nPREPROCESSING COMPLETE")
    print("=" * 70)
    print(f"Files processed:          {files_total}")
    print(f"Rows processed:           {len(df)}")
    print(f"Matches generated:        {len(manifest_matches)}")
    print(f"Maps:                     {', '.join(manifest['maps'])}")
    print(f"Dates:                    {', '.join(manifest['dates'])}")
    print(f"Manifest:                 {PUBLIC_DATA_DIR / 'manifest.json'}")
    print(f"Match files folder:        {PUBLIC_MATCHES_DIR}")
    print(f"Summary files folder:      {PUBLIC_SUMMARIES_DIR}")
    print(f"Minimaps folder:           {PUBLIC_MINIMAPS_DIR}")
    print("=" * 70)


if __name__ == "__main__":
    main()