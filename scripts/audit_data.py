from pathlib import Path
from collections import Counter, defaultdict
from PIL import Image
import json
import re
import pandas as pd
import pyarrow.parquet as pq


RAW_DATA_DIR = Path("raw_data/player_data")
REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(exist_ok=True)


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


def parse_filename(file_path: Path):
    """
    Expected filename:
    {user_id}_{match_id}.nakama-0

    Example:
    f4e072fa-b7af-4761-b567-1d95b7ad0108_b71aaad8-aa62-4b3a-8534-927d4de18f22.nakama-0
    """
    name = file_path.name

    if "_" not in name:
        return None, None

    filename_user_id, filename_match_id = name.split("_", 1)
    return filename_user_id, filename_match_id


def update_min_max(bounds: dict, key: str, value: float):
    if bounds[key] is None:
        bounds[key] = value
    elif key.endswith("_min"):
        bounds[key] = min(bounds[key], value)
    elif key.endswith("_max"):
        bounds[key] = max(bounds[key], value)


def main():
    if not RAW_DATA_DIR.exists():
        raise FileNotFoundError(
            f"Could not find {RAW_DATA_DIR}. Expected raw_data/player_data/README.md and date folders."
        )

    readme_path = RAW_DATA_DIR / "README.md"
    if not readme_path.exists():
        raise FileNotFoundError("README.md not found inside raw_data/player_data.")

    minimap_dir = RAW_DATA_DIR / "minimaps"
    if not minimap_dir.exists():
        raise FileNotFoundError("minimaps folder not found inside raw_data/player_data.")

    date_folders = sorted(
        folder
        for folder in RAW_DATA_DIR.iterdir()
        if folder.is_dir() and folder.name.startswith("February_")
    )

    if not date_folders:
        raise RuntimeError("No February_* folders found inside raw_data/player_data.")

    audit = {
        "files_total": 0,
        "files_readable": 0,
        "files_bad": 0,
        "bad_files": [],
        "rows_total": 0,
        "rows_by_date": Counter(),
        "rows_by_map": Counter(),
        "rows_by_event": Counter(),
        "rows_by_event_group": Counter(),
        "rows_by_player_type": Counter(),
        "events_by_player_type": defaultdict(Counter),
        "events_by_map": defaultdict(Counter),
        "events_by_date": defaultdict(Counter),
        "unique_players": set(),
        "unique_humans": set(),
        "unique_bots": set(),
        "unique_matches": set(),
        "unknown_events": Counter(),
        "unknown_maps": Counter(),
        "schema_variants": Counter(),
        "filename_mismatches": [],
        "multi_match_files": [],
        "multi_map_matches": set(),
        "coordinates_total": 0,
        "coordinates_out_of_bounds": 0,
        "bounds_by_map": defaultdict(
            lambda: {
                "x_min": None,
                "x_max": None,
                "z_min": None,
                "z_max": None,
                "u_min": None,
                "u_max": None,
                "v_min": None,
                "v_max": None,
            }
        ),
    }

    match_summary = {}

    for date_folder in date_folders:
        files = [
            file
            for file in date_folder.iterdir()
            if file.is_file() and not file.name.startswith(".")
        ]

        for file_path in files:
            audit["files_total"] += 1

            try:
                filename_user_id, filename_match_id = parse_filename(file_path)

                table = pq.read_table(file_path)
                audit["schema_variants"][str(table.schema)] += 1

                df = table.to_pandas()

                missing_columns = [
                    column for column in REQUIRED_COLUMNS if column not in df.columns
                ]
                if missing_columns:
                    raise ValueError(f"Missing required columns: {missing_columns}")

                df["event"] = df["event"].apply(decode_event)
                df["event_group"] = df["event"].apply(classify_event_group)
                df["user_id"] = df["user_id"].astype(str)
                df["match_id"] = df["match_id"].astype(str)
                df["map_id"] = df["map_id"].astype(str)
                df["player_type"] = df["user_id"].apply(get_player_type)

                audit["files_readable"] += 1
                audit["rows_total"] += len(df)
                audit["rows_by_date"][date_folder.name] += len(df)
                audit["rows_by_event"].update(df["event"])
                audit["rows_by_event_group"].update(df["event_group"])
                audit["rows_by_map"].update(df["map_id"])
                audit["rows_by_player_type"].update(df["player_type"])

                for player_type, group in df.groupby("player_type"):
                    audit["events_by_player_type"][player_type].update(group["event"])

                for map_id, group in df.groupby("map_id"):
                    audit["events_by_map"][map_id].update(group["event"])

                audit["events_by_date"][date_folder.name].update(df["event"])

                unique_file_user_ids = set(df["user_id"].unique())
                unique_file_match_ids = set(df["match_id"].unique())

                if len(unique_file_match_ids) > 1:
                    audit["multi_match_files"].append(str(file_path))

                if filename_user_id is None or filename_match_id is None:
                    audit["filename_mismatches"].append(
                        {
                            "file": str(file_path),
                            "reason": "Could not parse filename using expected {user_id}_{match_id}.nakama-0 format.",
                        }
                    )
                else:
                    if filename_user_id not in unique_file_user_ids:
                        audit["filename_mismatches"].append(
                            {
                                "file": str(file_path),
                                "reason": "Filename user_id does not match parquet user_id.",
                                "filename_user_id": filename_user_id,
                                "parquet_user_ids": sorted(unique_file_user_ids),
                            }
                        )

                    if filename_match_id not in unique_file_match_ids:
                        audit["filename_mismatches"].append(
                            {
                                "file": str(file_path),
                                "reason": "Filename match_id does not match parquet match_id.",
                                "filename_match_id": filename_match_id,
                                "parquet_match_ids": sorted(unique_file_match_ids),
                            }
                        )

                for event in df["event"].unique():
                    if event not in EXPECTED_EVENTS:
                        audit["unknown_events"][event] += int((df["event"] == event).sum())

                for map_id in df["map_id"].unique():
                    if map_id not in MAP_CONFIG:
                        audit["unknown_maps"][map_id] += int((df["map_id"] == map_id).sum())

                for user_id in df["user_id"].unique():
                    audit["unique_players"].add(user_id)
                    if is_human_user_id(user_id):
                        audit["unique_humans"].add(user_id)
                    else:
                        audit["unique_bots"].add(user_id)

                for match_id, match_group in df.groupby("match_id"):
                    audit["unique_matches"].add(match_id)

                    if match_id not in match_summary:
                        match_summary[match_id] = {
                            "match_id": match_id,
                            "date": date_folder.name,
                            "maps": set(),
                            "players": set(),
                            "humans": set(),
                            "bots": set(),
                            "event_count": 0,
                            "events": Counter(),
                            "event_groups": Counter(),
                            "min_ts": None,
                            "max_ts": None,
                        }

                    match_data = match_summary[match_id]
                    match_data["event_count"] += len(match_group)
                    match_data["maps"].update(match_group["map_id"].unique())
                    match_data["players"].update(match_group["user_id"].unique())
                    match_data["events"].update(match_group["event"])
                    match_data["event_groups"].update(match_group["event_group"])

                    for user_id in match_group["user_id"].unique():
                        if is_human_user_id(user_id):
                            match_data["humans"].add(user_id)
                        else:
                            match_data["bots"].add(user_id)

                    ts = pd.to_datetime(match_group["ts"])
                    min_ts = ts.min()
                    max_ts = ts.max()

                    if match_data["min_ts"] is None or min_ts < match_data["min_ts"]:
                        match_data["min_ts"] = min_ts
                    if match_data["max_ts"] is None or max_ts > match_data["max_ts"]:
                        match_data["max_ts"] = max_ts

                for map_id, group in df.groupby("map_id"):
                    if map_id not in MAP_CONFIG:
                        continue

                    config = MAP_CONFIG[map_id]
                    u = (group["x"] - config["origin_x"]) / config["scale"]
                    v = (group["z"] - config["origin_z"]) / config["scale"]

                    out_of_bounds = ((u < 0) | (u > 1) | (v < 0) | (v > 1)).sum()
                    audit["coordinates_out_of_bounds"] += int(out_of_bounds)
                    audit["coordinates_total"] += len(group)

                    bounds = audit["bounds_by_map"][map_id]

                    values = {
                        "x_min": float(group["x"].min()),
                        "x_max": float(group["x"].max()),
                        "z_min": float(group["z"].min()),
                        "z_max": float(group["z"].max()),
                        "u_min": float(u.min()),
                        "u_max": float(u.max()),
                        "v_min": float(v.min()),
                        "v_max": float(v.max()),
                    }

                    for key, value in values.items():
                        update_min_max(bounds, key, value)

            except Exception as error:
                audit["files_bad"] += 1
                audit["bad_files"].append(
                    {
                        "file": str(file_path),
                        "error": str(error),
                    }
                )

    for match_id, data in match_summary.items():
        if len(data["maps"]) > 1:
            audit["multi_map_matches"].add(match_id)

    minimap_info = {}
    for map_id, config in MAP_CONFIG.items():
        minimap_path = minimap_dir / config["minimap"]

        if not minimap_path.exists():
            minimap_info[config["minimap"]] = {
                "exists": False,
                "width": None,
                "height": None,
            }
            continue

        with Image.open(minimap_path) as image:
            minimap_info[config["minimap"]] = {
                "exists": True,
                "width": image.width,
                "height": image.height,
            }

    match_rows = []
    for match_id, data in match_summary.items():
        duration_ms = None
        if data["min_ts"] is not None and data["max_ts"] is not None:
            duration_ms = int((data["max_ts"] - data["min_ts"]).total_seconds() * 1000)

        match_rows.append(
            {
                "match_id": match_id,
                "date": data["date"],
                "maps": sorted(data["maps"]),
                "player_count": len(data["players"]),
                "human_count": len(data["humans"]),
                "bot_count": len(data["bots"]),
                "event_count": data["event_count"],
                "events": dict(data["events"]),
                "event_groups": dict(data["event_groups"]),
                "duration_ms": duration_ms,
            }
        )

    match_rows.sort(key=lambda item: item["event_count"], reverse=True)

    report = {
        "files_total": audit["files_total"],
        "files_readable": audit["files_readable"],
        "files_bad": audit["files_bad"],
        "bad_files_sample": audit["bad_files"][:20],
        "rows_total": audit["rows_total"],
        "rows_by_date": dict(audit["rows_by_date"]),
        "rows_by_map": dict(audit["rows_by_map"]),
        "rows_by_event": dict(audit["rows_by_event"]),
        "rows_by_event_group": dict(audit["rows_by_event_group"]),
        "rows_by_player_type": dict(audit["rows_by_player_type"]),
        "events_by_player_type": {
            player_type: dict(counter)
            for player_type, counter in audit["events_by_player_type"].items()
        },
        "events_by_map": {
            map_id: dict(counter)
            for map_id, counter in audit["events_by_map"].items()
        },
        "events_by_date": {
            date: dict(counter)
            for date, counter in audit["events_by_date"].items()
        },
        "unique_players": len(audit["unique_players"]),
        "unique_humans": len(audit["unique_humans"]),
        "unique_bots": len(audit["unique_bots"]),
        "unique_matches": len(audit["unique_matches"]),
        "unknown_events": dict(audit["unknown_events"]),
        "unknown_maps": dict(audit["unknown_maps"]),
        "schema_variant_count": len(audit["schema_variants"]),
        "filename_mismatch_count": len(audit["filename_mismatches"]),
        "filename_mismatch_sample": audit["filename_mismatches"][:20],
        "multi_match_file_count": len(audit["multi_match_files"]),
        "multi_match_files_sample": audit["multi_match_files"][:20],
        "multi_map_match_count": len(audit["multi_map_matches"]),
        "multi_map_matches_sample": sorted(audit["multi_map_matches"])[:20],
        "coordinates_total": audit["coordinates_total"],
        "coordinates_out_of_bounds": audit["coordinates_out_of_bounds"],
        "bounds_by_map": dict(audit["bounds_by_map"]),
        "minimap_info": minimap_info,
        "top_matches_by_event_count": match_rows[:20],
    }

    report_path = REPORTS_DIR / "audit_report.json"
    with report_path.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    summary_path = REPORTS_DIR / "audit_summary.md"
    with summary_path.open("w", encoding="utf-8") as file:
        file.write("# Dataset Audit Summary\n\n")
        file.write("## Core Counts\n\n")
        file.write(f"- Files total: {report['files_total']}\n")
        file.write(f"- Files readable: {report['files_readable']}\n")
        file.write(f"- Files bad: {report['files_bad']}\n")
        file.write(f"- Total rows: {report['rows_total']}\n")
        file.write(f"- Unique players: {report['unique_players']}\n")
        file.write(f"- Unique humans: {report['unique_humans']}\n")
        file.write(f"- Unique bots: {report['unique_bots']}\n")
        file.write(f"- Unique matches: {report['unique_matches']}\n\n")

        file.write("## Validation Results\n\n")
        file.write(f"- Schema variants: {report['schema_variant_count']}\n")
        file.write(f"- Unknown events: {report['unknown_events']}\n")
        file.write(f"- Unknown maps: {report['unknown_maps']}\n")
        file.write(f"- Filename mismatches: {report['filename_mismatch_count']}\n")
        file.write(f"- Multi-match files: {report['multi_match_file_count']}\n")
        file.write(f"- Multi-map matches: {report['multi_map_match_count']}\n")
        file.write(f"- Coordinates out of bounds: {report['coordinates_out_of_bounds']}\n\n")

        file.write("## Rows by Date\n\n")
        for date, count in report["rows_by_date"].items():
            file.write(f"- {date}: {count}\n")

        file.write("\n## Rows by Map\n\n")
        for map_id, count in report["rows_by_map"].items():
            file.write(f"- {map_id}: {count}\n")

        file.write("\n## Rows by Event\n\n")
        for event, count in report["rows_by_event"].items():
            file.write(f"- {event}: {count}\n")

        file.write("\n## Rows by Player Type\n\n")
        for player_type, count in report["rows_by_player_type"].items():
            file.write(f"- {player_type}: {count}\n")

        file.write("\n## Minimap Info\n\n")
        for minimap, info in report["minimap_info"].items():
            file.write(
                f"- {minimap}: exists={info['exists']}, "
                f"width={info['width']}, height={info['height']}\n"
            )

    print("\nDATASET AUDIT COMPLETE")
    print("=" * 70)
    print(f"Files total:                {report['files_total']}")
    print(f"Files readable:             {report['files_readable']}")
    print(f"Files bad:                  {report['files_bad']}")
    print(f"Rows total:                 {report['rows_total']}")
    print(f"Unique players:             {report['unique_players']}")
    print(f"Unique humans:              {report['unique_humans']}")
    print(f"Unique bots:                {report['unique_bots']}")
    print(f"Unique matches:             {report['unique_matches']}")
    print(f"Schema variant count:       {report['schema_variant_count']}")
    print(f"Unknown events:             {report['unknown_events']}")
    print(f"Unknown maps:               {report['unknown_maps']}")
    print(f"Filename mismatches:        {report['filename_mismatch_count']}")
    print(f"Multi-match files:          {report['multi_match_file_count']}")
    print(f"Multi-map matches:          {report['multi_map_match_count']}")
    print(f"Coordinates out of bounds:  {report['coordinates_out_of_bounds']}")
    print(f"Audit JSON saved to:        {report_path}")
    print(f"Audit summary saved to:     {summary_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()