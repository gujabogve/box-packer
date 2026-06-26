# Ideas

## Inventory / stock tracking (planned — Phase ⑥)

Treat plywood as inventory. When buying, register stock per board SKU (`dimensions × thickness`,
e.g. `2440×1220×15`). Assign boards to projects manually (3 → chair, 4 → table) so the app can
answer "what can I still make?" = sum of project board requirements vs remaining stock.

- Mostly 15mm, but support other thicknesses (the `thickness` field is already on every sheet).
- New Dexie `stock` table: `{ skuId, w, h, thickness, qty }` + per-project allocations.
- Schema is already thickness-aware so this bolts on without migration.
