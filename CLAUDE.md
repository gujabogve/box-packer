# Box Packer

A single-file 2D rectangle-packing tool for planning **plywood / sheet-goods cuts**. Lay out small
rectangles inside one big sheet to see how they fit and — crucially — how big the **leftover offcut** is.

## The idea

Goal isn't just dense packing; it's leaving the **largest single usable offcut** (ideally a clean
full-width or full-height strip you can reuse). Greedy packers don't do that well, so the tool offers
several methods side by side and lets you hand-tweak the result.

## Stack

- Pure `index.html` — no build, no deps. Open directly (`xdg-open index.html`) or via the `packr` tmux session.
- Canvas 2D rendering, vanilla JS, tabs/spaces per global style.

## Key concepts

- **Offcut score** — area with a 1.2× bonus for rectangles spanning the full board width/height (clean strips rank higher).
- **Packing methods** (compared side by side, click a thumbnail to load it into the editable canvas):
  - **Search** — 5000 randomized orderings through MaxRects + compaction; best offcut wins. Re-pack for more tries (randomized).
  - **Compact** — MaxRects + corner compaction (densest).
  - **Gap-fill** — Compact, then lifts stranded pieces into higher gaps to free an edge strip.
  - **Rows / Columns** — shelf packing; naturally leaves a full-width / full-height strip.
- **Manual edit** — drag pieces (snaps to edges), double-click to rotate; offcut recomputes live.
- **Saw kerf** (optional) — adds a per-piece blade-width margin so cut sizes stay accurate.
- **JSON import/export** — paste a setup or copy the current one.

## Notes

- True optimal 2D packing is NP-hard; Search approximates, doesn't prove optimal.
- Kerf model is a uniform per-piece margin (conservative — edge pieces reserve kerf they don't strictly need).
