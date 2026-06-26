# Ideas

## Inventory / stock tracking (planned — Phase ⑥)

Treat plywood as inventory. When buying, register stock per board SKU (`dimensions × thickness`,
e.g. `2440×1220×15`). Assign boards to projects manually (3 → chair, 4 → table) so the app can
answer "what can I still make?" = sum of project board requirements vs remaining stock.

- Mostly 15mm, but support other thicknesses (the `thickness` field is already on every sheet).
- New Dexie `stock` table: `{ skuId, w, h, thickness, qty }` + per-project allocations.
- Schema is already thickness-aware so this bolts on without migration.

## Part groups + auto-fill + multi-sheet planning (requested)

Treat a sheet's piece list as **one product's parts** (e.g. a chair = 2× Side, 1× Seat, 1× Back).
Then:

- **Auto-fill** — pack as many *complete products* as fit on one sheet; show "fits N products/sheet".
- **Make N products** — given a target count, compute the sheets needed (e.g. 5 products = 2 sheets,
  3+2) and lay out each, creating sibling sheets in the project.

Likely model: add a `units` field on Sheet (copies of the part list to place); `buildItems` multiplies
qty × units; a `maxUnitsThatFit` helper; and a distribute action that reuses the existing
"overflow → new sheet" plumbing. Open question: keep this per-sheet (`units`) or introduce a real
project-level Product/BOM entity reused across sheets.
