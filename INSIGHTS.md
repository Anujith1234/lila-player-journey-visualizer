# Level Design Insights

This document summarizes three evidence-backed level-design observations from the processed LILA BLACK telemetry dataset used in the Player Journey Visualizer.

The goal is not to make final design decisions from telemetry alone. The goal is to identify areas that Level Designers should inspect more closely using map filters, timeline playback, event markers, and heatmap overlays.

## Dataset Used

- Source files processed: 1,243
- Events processed: 89,104
- Match sessions: 797
- Unique players/entities: 339
- Humans: 245
- Bots: 94
- Maps reviewed:
  - AmbroseValley
  - GrandRift
  - Lockdown
- Dates reviewed:
  - February_10
  - February_11
  - February_12
  - February_13
  - February_14

## Insight 1 — Lockdown has the highest activity per match

### What caught my eye

Lockdown has the highest average telemetry activity among the three maps, with `124.20` events per match.

### Evidence

| Map | Matches | Events | Average events per match |
|---|---:|---:|---:|
| AmbroseValley | 567 | 61,013 | 107.61 |
| GrandRift | 59 | 6,853 | 116.15 |
| Lockdown | 171 | 21,238 | 124.20 |

Lockdown also contains:

- 18,577 movement events
- 426 kill events
- 168 death events
- 2,050 loot events
- 17 storm death events

### Why a level designer should care

Higher activity per match can indicate that players are being funneled into repeated routes or high-interaction zones. This may be intended if Lockdown is designed for tighter engagements, but it can also indicate route predictability or limited rotation options.

### Actionable items

Review Lockdown with:

- Traffic heatmap enabled
- Kill and death markers enabled
- Timeline playback enabled
- All/Humans/Bots heatmap population filters compared separately

If traffic is concentrated into a small number of routes, consider:

- adding alternate rotation paths,
- adjusting cover placement,
- reviewing spawn approach routes,
- checking whether loot placement is pulling players into predictable paths.

### Metrics likely affected

- Route diversity
- Combat encounter frequency
- Early-match engagement rate
- Death concentration by zone
- Player rotation behavior

## Insight 2 — AmbroseValley has repeated combat pressure near the same region

### What caught my eye

The strongest kill hotspot and strongest death hotspot both appear on AmbroseValley on February_10, and their grid cells are close to each other.

### Evidence

Top kill hotspot:

| Map | Date | Cell X | Cell Y | Count |
|---|---|---:|---:|---:|
| AmbroseValley | February_10 | 24 | 32 | 13 |

Top death hotspot:

| Map | Date | Cell X | Cell Y | Count |
|---|---|---:|---:|---:|
| AmbroseValley | February_10 | 26 | 33 | 7 |

The strongest loot and traffic hotspots on AmbroseValley also appear on February_10:

| Hotspot type | Map | Date | Cell X | Cell Y | Count |
|---|---|---|---:|---:|---:|
| Loot | AmbroseValley | February_10 | 22 | 8 | 117 |
| Traffic | AmbroseValley | February_10 | 25 | 13 | 188 |

### Why a level designer should care

When kill and death hotspots appear close together, the area may be acting as a choke point, a high-visibility fight zone, or a forced traversal path.

The nearby loot and traffic concentration should also be reviewed because loot placement can reinforce predictable movement and create repeated combat pressure.

### Actionable items

Inspect AmbroseValley on February_10 using:

- Kill markers
- Death markers
- Loot heatmap
- Traffic heatmap
- Timeline playback

If the combat hotspot overlaps a narrow route, consider:

- adding cover,
- opening an alternate path,
- softening long sightlines,
- redistributing nearby loot,
- reviewing spawn-to-combat timing.

### Metrics likely affected

- Kill concentration
- Death concentration
- Loot pickup distribution
- Route predictability
- Time-to-first-combat
- Player survival rate in hotspot areas

## Insight 3 — Human and bot traffic should not be analyzed only in aggregate

### What caught my eye

The strongest human traffic cell and strongest bot traffic cell are not the same.

### Evidence

Top human traffic hotspot:

| Map | Date | Cell X | Cell Y | Count |
|---|---|---:|---:|---:|
| AmbroseValley | February_10 | 25 | 13 | 171 |

Top bot traffic hotspot:

| Map | Date | Cell X | Cell Y | Count |
|---|---|---:|---:|---:|
| AmbroseValley | February_10 | 26 | 33 | 76 |

### Why a level designer should care

Aggregate traffic can hide the difference between human decision-making and bot navigation behavior.

If a traffic hotspot is mostly caused by bots, changing the map layout based only on aggregate traffic may lead to the wrong design decision. Human routes should be reviewed separately before making changes to level flow, loot placement, or cover.

### Actionable items

For each map, compare:

- All traffic
- Human traffic
- Bot traffic

Use the Humans/Bots layer toggles and heatmap population filter before making route or layout decisions.

If bot hotspots do not match human hotspots, review bot pathing separately before changing:

- route structure,
- cover placement,
- loot distribution,
- spawn approach paths.

### Metrics likely affected

- Human route diversity
- Bot navigation quality
- Encounter quality
- Misleading aggregate heatmap interpretation
- AI-driven combat concentration

## How to Validate These Insights in the Tool

1. Open the Player Journey Visualizer.
2. Select the map and date mentioned in each insight.
3. Enable the relevant heatmap layer.
4. Compare All, Humans, and Bots in the heatmap population filter.
5. Use timeline playback to check whether events happen early, mid, or late in the match.
6. Use marker layers to confirm whether heatmap hotspots match actual event locations.

## Notes

These insights are based on the provided telemetry dataset and generated summaries. They should be used as review starting points, not final design decisions on their own.

A level designer should validate each hotspot in the actual map context before applying layout, loot, spawn, or cover changes.