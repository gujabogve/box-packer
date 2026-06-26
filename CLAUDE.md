# Box Packer

An installable **PWA** for planning **plywood / sheet-goods cuts**. Lay out named pieces inside named
plywood sheets, grouped into furniture projects, and see how they fit — crucially, how big the
largest reusable **offcut** is. All data lives on-device; works fully offline.

Live: https://gujabogve.github.io/box-packer/

## The idea

Goal isn't just dense packing; it's leaving the **largest single usable offcut** (ideally a clean
full-width / full-height strip). Greedy packers don't do that well, so the tool offers several methods
side by side and lets you hand-tweak the result, then save the one you like.

## Stack

- **Vite + Vue 3 (`<script setup lang="ts">`) + TypeScript + Tailwind v4 + Pinia + Dexie**.
- **PWA** via `vite-plugin-pwa` (Workbox, `autoUpdate`). Canvas 2D for layout rendering.
- **Package manager: pnpm.** `workbox-window` must stay a direct dep (pnpm won't resolve it
  transitively for `virtual:pwa-register/vue`).

## Commands

- `pnpm dev` — dev server (no service worker, by design).
- `pnpm build` — typecheck + production build to `dist/`.
- `pnpm preview` — serve the build locally (service worker active — use this to test the PWA).
- `pnpm deploy` — `pnpm build && gh-pages -d dist` → publishes to the `gh-pages` branch (GitHub Pages).
- `node scripts/gen-icons.mjs` — regenerate the PWA icons.

## Data model — Project → Sheet → Piece

- **Project** — a piece of furniture (e.g. "Dining Chair"); holds several sheets.
- **Sheet** — one plywood board: named, `container` size, `thickness`, options, pieces, and a saved layout.
- **Piece** — a named cut rectangle (`name`, `w`, `h`, `qty`).
- One Dexie object store (`projects`), each a document with nested sheets. Export/import JSON for backup.
- **Units: cm** for board + piece dimensions, **mm** for thickness (default 15). Sheet presets: `122×244`, `152×152`.

## Layout / navigation

- Bottom tab bar: **Projects / Sheets / Settings**. Sheets tab = the active project's detail (switch
  via the header dropdown). A sheet opens the editor with a **Setup / Layout** segmented control.

## Key concepts

- **Offcut score** — area, ×1.2 bonus for rectangles spanning the full board width/height (clean strips rank higher).
- **Packing methods** (`src/lib/packer.ts`, compared side by side; click a variant to load it):
  - **Search** — randomized multi-restart through MaxRects + compaction; best offcut wins. Re-pack for more tries.
  - **Compact** — MaxRects + corner compaction (densest).
  - **Gap-fill** — Compact, then lifts stranded pieces to free an edge strip.
  - **Rows / Columns** — shelf packing; leaves a full-width / full-height strip.
- **Save layout** — store the picked or hand-edited arrangement (method = `Manual` if edited). On reopen
  the variants regenerate and the saved layout is pinned first.
- **Overflow** — if pieces don't fit, "Move to a new sheet" creates a sibling sheet with the leftovers.
- **Manual edit** — drag pieces (snaps to edges), double-tap / double-click to rotate; offcut recomputes live.
- **Saw kerf** (optional) — per-piece blade-width margin so cut sizes stay accurate.

## Project structure

- `src/lib/` — `packer.ts` (engine), `methods.ts` (build items + run methods), `render.ts`, `types.ts`.
- `src/db/` — Dexie schema. `src/stores/projects.ts` — Pinia store. `src/views/`, `src/components/`.
- `reference/old-app.html` was the original single-file prototype (removed once the port was verified).

## Notes

- True optimal 2D packing is NP-hard; Search approximates, doesn't prove optimal.
- Inventory/stock tracking is planned (`docs/IDEAS.md`) — the `thickness` field already supports it.

## Inherited rules

Global rules at `~/.claude/CLAUDE.md` apply. Project-specific: commits/pushes and deploys happen on
explicit request (no project skill yet); `pnpm deploy` is the publish path.
