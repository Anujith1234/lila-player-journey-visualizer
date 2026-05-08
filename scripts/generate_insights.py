from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
SUMMARY_DIR = PUBLIC_DATA_DIR / "summaries"
REPORTS_DIR = PROJECT_ROOT / "reports"

MANIFEST_PATH = PUBLIC_DATA_DIR / "manifest.json"
HEATMAP_PATH = SUMMARY_DIR / "heatmap_points.json"

INSIGHTS_JSON_PATH = REPORTS_DIR / "insights_summary.json"
INSIGHTS_MD_PATH = REPORTS_DIR / "insights_summary.md"

HEATMAP_LAYERS = ["traffic", "kills", "deaths", "loot", "stormDeaths"]
PLAYER_FILTERS = ["all", "human", "bot"]


def read_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Required input file not found: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def write_markdown(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def format_count(value: int | float) -> str:
    if isinstance(value, float):
        return f"{value:,.2f}"

    return f"{value:,}"


def get_event_group_count(summary: dict[str, Any], group_name: str) -> int:
    return int(summary.get("eventGroups", {}).get(group_name, 0))


def get_top_matches(manifest: dict[str, Any], limit: int = 10) -> list[dict[str, Any]]:
    return sorted(
        manifest["matches"],
        key=lambda match: match["eventCount"],
        reverse=True,
    )[:limit]


def summarize_matches_by_map(manifest: dict[str, Any]) -> dict[str, Any]:
    by_map: dict[str, dict[str, Any]] = {}

    for map_id in manifest["maps"]:
        by_map[map_id] = {
            "matchCount": 0,
            "eventCount": 0,
            "playerCountTotal": 0,
            "humanCountTotal": 0,
            "botCountTotal": 0,
            "events": defaultdict(int),
            "eventGroups": defaultdict(int),
        }

    for match in manifest["matches"]:
        map_id = match["mapId"]
        map_summary = by_map[map_id]

        map_summary["matchCount"] += 1
        map_summary["eventCount"] += int(match["eventCount"])
        map_summary["playerCountTotal"] += int(match["playerCount"])
        map_summary["humanCountTotal"] += int(match["humanCount"])
        map_summary["botCountTotal"] += int(match["botCount"])

        for event_name, count in match["events"].items():
            map_summary["events"][event_name] += int(count)

        for group_name, count in match["eventGroups"].items():
            map_summary["eventGroups"][group_name] += int(count)

    for summary in by_map.values():
        match_count = max(summary["matchCount"], 1)

        summary["avgEventsPerMatch"] = round(
            summary["eventCount"] / match_count,
            2,
        )
        summary["avgTrackedEntitiesPerMatch"] = round(
            summary["playerCountTotal"] / match_count,
            2,
        )
        summary["avgHumansPerMatch"] = round(
            summary["humanCountTotal"] / match_count,
            2,
        )
        summary["avgBotsPerMatch"] = round(
            summary["botCountTotal"] / match_count,
            2,
        )
        summary["events"] = dict(sorted(summary["events"].items()))
        summary["eventGroups"] = dict(sorted(summary["eventGroups"].items()))

    return by_map


def get_top_heatmap_cells(
    heatmap: dict[str, Any],
    layer: str,
    player_filter: str = "all",
    limit: int = 8,
) -> list[dict[str, Any]]:
    cells = heatmap["layers"].get(layer, {}).get(player_filter, [])

    return sorted(cells, key=lambda cell: cell["count"], reverse=True)[:limit]


def summarize_heatmaps(heatmap: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {}

    for layer in HEATMAP_LAYERS:
        layer_summary: dict[str, Any] = {}

        for player_filter in PLAYER_FILTERS:
            layer_summary[f"top{player_filter.title()}"] = get_top_heatmap_cells(
                heatmap,
                layer,
                player_filter,
            )

        summary[layer] = layer_summary

    return summary


def build_cell_label(cell: dict[str, Any]) -> str:
    return (
        f"{cell['mapId']} on {cell['date']} "
        f"(cell {cell['cellX']}, {cell['cellY']}, count {cell['count']})"
    )


def build_candidate_insights(
    map_summary: dict[str, Any],
    heatmap_summary: dict[str, Any],
) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []

    busiest_map_id, busiest_map_summary = max(
        map_summary.items(),
        key=lambda item: item[1]["avgEventsPerMatch"],
    )

    insights.append(
        {
            "title": "Lock high-activity maps for focused flow review",
            "finding": (
                f"{busiest_map_id} has the highest average telemetry activity "
                f"at {busiest_map_summary['avgEventsPerMatch']} events per match."
            ),
            "evidence": {
                "map": busiest_map_id,
                "matchCount": busiest_map_summary["matchCount"],
                "eventCount": busiest_map_summary["eventCount"],
                "avgEventsPerMatch": busiest_map_summary["avgEventsPerMatch"],
                "eventGroups": busiest_map_summary["eventGroups"],
            },
            "recommendation": (
                "Use the traffic heatmap with map/date filters to check whether "
                "movement is concentrated into a small number of routes. If the "
                "density is too narrow, review route variety, cover placement, "
                "spawn approach paths, and rotation options."
            ),
        }
    )

    top_kill_cell = heatmap_summary["kills"]["topAll"][0]
    top_death_cell = heatmap_summary["deaths"]["topAll"][0]

    insights.append(
        {
            "title": "Review repeated combat and death hotspots for choke pressure",
            "finding": (
                f"The strongest kill hotspot appears on {top_kill_cell['mapId']} "
                f"on {top_kill_cell['date']} with {top_kill_cell['count']} events. "
                f"The strongest death hotspot appears on {top_death_cell['mapId']} "
                f"on {top_death_cell['date']} with {top_death_cell['count']} events."
            ),
            "evidence": {
                "topKillCell": top_kill_cell,
                "topDeathCell": top_death_cell,
            },
            "recommendation": (
                "Inspect these cells in the viewer with kill/death markers enabled. "
                "If the hotspots overlap narrow traversal routes, consider adding "
                "alternate paths, cover, visibility breaks, or loot/spawn adjustments."
            ),
        }
    )

    top_human_traffic = heatmap_summary["traffic"]["topHuman"][0]
    top_bot_traffic = heatmap_summary["traffic"]["topBot"][0]

    insights.append(
        {
            "title": "Compare human and bot traffic before tuning routes",
            "finding": (
                "The strongest human and bot traffic cells are not identical, which "
                "means human intent and bot pathing should be reviewed separately."
            ),
            "evidence": {
                "topHumanTrafficCell": top_human_traffic,
                "topBotTrafficCell": top_bot_traffic,
            },
            "recommendation": (
                "Use the Humans/Bots toggles and heatmap population filter to separate "
                "real player behavior from AI movement. If bot hotspots do not match "
                "human routes, review bot navigation influence before making level "
                "layout decisions from aggregate traffic alone."
            ),
        }
    )

    top_loot_cell = heatmap_summary["loot"]["topAll"][0]
    top_traffic_cell = heatmap_summary["traffic"]["topAll"][0]

    insights.append(
        {
            "title": "Check loot concentration against traffic concentration",
            "finding": (
                f"The strongest loot hotspot is {build_cell_label(top_loot_cell)}, "
                f"while the strongest traffic hotspot is {build_cell_label(top_traffic_cell)}."
            ),
            "evidence": {
                "topLootCell": top_loot_cell,
                "topTrafficCell": top_traffic_cell,
            },
            "recommendation": (
                "Compare loot and traffic overlays to see whether loot placement is "
                "pulling players into predictable routes. If loot and traffic overlap "
                "too strongly, consider redistributing rewards to support broader map use."
            ),
        }
    )

    return insights


def build_markdown_report(insights_data: dict[str, Any]) -> str:
    lines: list[str] = []

    dataset = insights_data["dataset"]

    lines.append("# Telemetry Insights Summary")
    lines.append("")
    lines.append(
        "Generated from the preprocessed LILA BLACK telemetry dataset used by the "
        "Player Journey Visualizer."
    )
    lines.append("")

    lines.append("## Dataset")
    lines.append("")
    lines.append(f"- Source files processed: {dataset['filesTotal']:,}")
    lines.append(f"- Match sessions: {dataset['matchCount']:,}")
    lines.append(f"- Events: {dataset['rowsTotal']:,}")
    lines.append(f"- Unique players/entities: {dataset['playerCount']:,}")
    lines.append(f"- Humans: {dataset['humanCount']:,}")
    lines.append(f"- Bots: {dataset['botCount']:,}")
    lines.append("")

    lines.append("## Map Summary")
    lines.append("")

    for map_id, summary in insights_data["mapSummary"].items():
        event_groups = summary["eventGroups"]

        lines.append(f"### {map_id}")
        lines.append("")
        lines.append(f"- Matches: {summary['matchCount']:,}")
        lines.append(f"- Events: {summary['eventCount']:,}")
        lines.append(f"- Average events per match: {summary['avgEventsPerMatch']}")
        lines.append(
            "- Average tracked entities per match: "
            f"{summary['avgTrackedEntitiesPerMatch']}"
        )
        lines.append(f"- Average humans per match: {summary['avgHumansPerMatch']}")
        lines.append(f"- Average bots per match: {summary['avgBotsPerMatch']}")
        lines.append(f"- Movement events: {event_groups.get('movement', 0):,}")
        lines.append(f"- Kill events: {event_groups.get('kill', 0):,}")
        lines.append(f"- Death events: {event_groups.get('death', 0):,}")
        lines.append(f"- Loot events: {event_groups.get('loot', 0):,}")
        lines.append(f"- Storm deaths: {event_groups.get('storm_death', 0):,}")
        lines.append("")

    lines.append("## Level Design Insights")
    lines.append("")

    for index, insight in enumerate(insights_data["candidateInsights"], start=1):
        lines.append(f"### {index}. {insight['title']}")
        lines.append("")
        lines.append(f"**Finding:** {insight['finding']}")
        lines.append("")
        lines.append(f"**Recommendation:** {insight['recommendation']}")
        lines.append("")
        lines.append("**Evidence:**")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(insight["evidence"], indent=2))
        lines.append("```")
        lines.append("")

    lines.append("## How to Use These Insights")
    lines.append("")
    lines.append(
        "- Open the viewer and select the map/date mentioned in the evidence."
    )
    lines.append(
        "- Use heatmap layers to inspect density before using individual match paths."
    )
    lines.append(
        "- Use Humans/Bots filters separately before making route or spawn conclusions."
    )
    lines.append(
        "- Validate hotspot conclusions by checking multiple dates and match sessions."
    )
    lines.append("")

    return "\n".join(lines)


def validate_inputs(manifest: dict[str, Any], heatmap: dict[str, Any]) -> None:
    required_manifest_keys = {"summary", "maps", "dates", "matches"}
    missing_manifest_keys = required_manifest_keys - manifest.keys()

    if missing_manifest_keys:
        raise ValueError(
            f"manifest.json is missing keys: {sorted(missing_manifest_keys)}"
        )

    if "layers" not in heatmap:
        raise ValueError("heatmap_points.json is missing the 'layers' key")

    for layer in HEATMAP_LAYERS:
        if layer not in heatmap["layers"]:
            raise ValueError(f"heatmap_points.json is missing layer: {layer}")


def main() -> None:
    print("GENERATING TELEMETRY INSIGHTS")
    print("=" * 70)

    manifest = read_json(MANIFEST_PATH)
    heatmap = read_json(HEATMAP_PATH)

    validate_inputs(manifest, heatmap)

    map_summary = summarize_matches_by_map(manifest)
    heatmap_summary = summarize_heatmaps(heatmap)
    top_matches = get_top_matches(manifest)
    candidate_insights = build_candidate_insights(
        map_summary,
        heatmap_summary,
    )

    insights_data = {
        "dataset": manifest["summary"],
        "maps": manifest["maps"],
        "dates": manifest["dates"],
        "mapSummary": map_summary,
        "topMatchesByEventCount": top_matches,
        "heatmapSummary": heatmap_summary,
        "candidateInsights": candidate_insights,
    }

    write_json(INSIGHTS_JSON_PATH, insights_data)
    write_markdown(INSIGHTS_MD_PATH, build_markdown_report(insights_data))

    print(f"Wrote: {INSIGHTS_JSON_PATH}")
    print(f"Wrote: {INSIGHTS_MD_PATH}")
    print("=" * 70)


if __name__ == "__main__":
    main()