# Telemetry Insights Summary

Generated from the preprocessed LILA BLACK telemetry dataset used by the Player Journey Visualizer.

## Dataset

- Source files processed: 1,243
- Match sessions: 797
- Events: 89,104
- Unique players/entities: 339
- Humans: 245
- Bots: 94

## Map Summary

### AmbroseValley

- Matches: 567
- Events: 61,013
- Average events per match: 107.61
- Average tracked entities per match: 1.48
- Average humans per match: 0.98
- Average bots per match: 0.5
- Movement events: 48,754
- Kill events: 1,799
- Death events: 488
- Loot events: 9,955
- Storm deaths: 17

### GrandRift

- Matches: 59
- Events: 6,853
- Average events per match: 116.15
- Average tracked entities per match: 1.88
- Average humans per match: 0.97
- Average bots per match: 0.92
- Movement events: 5,728
- Kill events: 193
- Death events: 47
- Loot events: 880
- Storm deaths: 5

### Lockdown

- Matches: 171
- Events: 21,238
- Average events per match: 124.2
- Average tracked entities per match: 1.73
- Average humans per match: 0.99
- Average bots per match: 0.73
- Movement events: 18,577
- Kill events: 426
- Death events: 168
- Loot events: 2,050
- Storm deaths: 17

## Level Design Insights

### 1. Lock high-activity maps for focused flow review

**Finding:** Lockdown has the highest average telemetry activity at 124.2 events per match.

**Recommendation:** Use the traffic heatmap with map/date filters to check whether movement is concentrated into a small number of routes. If the density is too narrow, review route variety, cover placement, spawn approach paths, and rotation options.

**Evidence:**

```json
{
  "map": "Lockdown",
  "matchCount": 171,
  "eventCount": 21238,
  "avgEventsPerMatch": 124.2,
  "eventGroups": {
    "death": 168,
    "kill": 426,
    "loot": 2050,
    "movement": 18577,
    "storm_death": 17
  }
}
```

### 2. Review repeated combat and death hotspots for choke pressure

**Finding:** The strongest kill hotspot appears on AmbroseValley on February_10 with 13 events. The strongest death hotspot appears on AmbroseValley on February_10 with 7 events.

**Recommendation:** Inspect these cells in the viewer with kill/death markers enabled. If the hotspots overlap narrow traversal routes, consider adding alternate paths, cover, visibility breaks, or loot/spawn adjustments.

**Evidence:**

```json
{
  "topKillCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 24,
    "cellY": 32,
    "centerU": 0.382812,
    "centerV": 0.507812,
    "count": 13
  },
  "topDeathCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 26,
    "cellY": 33,
    "centerU": 0.414062,
    "centerV": 0.523438,
    "count": 7
  }
}
```

### 3. Compare human and bot traffic before tuning routes

**Finding:** The strongest human and bot traffic cells are not identical, which means human intent and bot pathing should be reviewed separately.

**Recommendation:** Use the Humans/Bots toggles and heatmap population filter to separate real player behavior from AI movement. If bot hotspots do not match human routes, review bot navigation influence before making level layout decisions from aggregate traffic alone.

**Evidence:**

```json
{
  "topHumanTrafficCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 25,
    "cellY": 13,
    "centerU": 0.398438,
    "centerV": 0.210938,
    "count": 171
  },
  "topBotTrafficCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 26,
    "cellY": 33,
    "centerU": 0.414062,
    "centerV": 0.523438,
    "count": 76
  }
}
```

### 4. Check loot concentration against traffic concentration

**Finding:** The strongest loot hotspot is AmbroseValley on February_10 (cell 22, 8, count 117), while the strongest traffic hotspot is AmbroseValley on February_10 (cell 25, 13, count 188).

**Recommendation:** Compare loot and traffic overlays to see whether loot placement is pulling players into predictable routes. If loot and traffic overlap too strongly, consider redistributing rewards to support broader map use.

**Evidence:**

```json
{
  "topLootCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 22,
    "cellY": 8,
    "centerU": 0.351562,
    "centerV": 0.132812,
    "count": 117
  },
  "topTrafficCell": {
    "mapId": "AmbroseValley",
    "date": "February_10",
    "cellX": 25,
    "cellY": 13,
    "centerU": 0.398438,
    "centerV": 0.210938,
    "count": 188
  }
}
```

## How to Use These Insights

- Open the viewer and select the map/date mentioned in the evidence.
- Use heatmap layers to inspect density before using individual match paths.
- Use Humans/Bots filters separately before making route or spawn conclusions.
- Validate hotspot conclusions by checking multiple dates and match sessions.
