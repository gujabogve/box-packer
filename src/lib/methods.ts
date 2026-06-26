import {
	columnPack,
	largestEmptyRect,
	maxrectsBest,
	offcutScore,
	PALETTE,
	searchBest,
	shelfPack,
	type Offcut,
	type PackItem,
	type PackNode,
} from './packer';
import type { Piece, Sheet } from './types';

export interface MethodCandidate {
	name: string;
	placed: PackNode[];
	unplaced: PackItem[];
	offcut: Offcut | null;
	score: [number, number];
}

// Expand a sheet's piece list into individual items. Footprint (w/h) includes kerf;
// the real cut size is kept as rw/rh. Labels use the piece name, falling back to dimensions.
export function buildItems(sheet: Sheet): PackItem[] {
	const kerf = sheet.options.useKerf ? Math.max(0, sheet.options.kerf || 0) : 0;
	const items: PackItem[] = [];
	sheet.pieces.forEach((b, gi) => {
		const qty = Math.max(1, Math.floor(b.qty || 1));
		for (let q = 0; q < qty; q++) {
			items.push({
				w: b.w + kerf,
				h: b.h + kerf,
				rw: b.w,
				rh: b.h,
				color: PALETTE[gi % PALETTE.length],
				label: b.name.trim() || `${b.w}×${b.h}`,
			});
		}
	});
	return items;
}

// Grow the container height until every item fits (capped). Returns the new height.
export function growToFit(items: PackItem[], W: number, Hstart: number, rot: boolean): number {
	let H = Hstart;
	for (let tries = 0; tries < 60; tries++) {
		if (maxrectsBest(items, W, H, rot, true).unplaced.length === 0) break;
		H = H * 1.25 + 1;
	}
	return Math.round(H * 1000) / 1000;
}

// Run all five methods and return them sorted best-first by [placed count, offcut score].
export function runMethods(items: PackItem[], W: number, H: number, rot: boolean, searchIters = 5000): MethodCandidate[] {
	const methods: { name: string; fn: () => { placed: PackNode[]; unplaced: PackItem[] } }[] = [
		{ name: 'Search', fn: () => searchBest(items, W, H, rot, searchIters) },
		{ name: 'Compact', fn: () => maxrectsBest(items, W, H, rot, false) },
		{ name: 'Gap-fill', fn: () => maxrectsBest(items, W, H, rot, true) },
		{ name: 'Rows', fn: () => shelfPack(items, W, H, rot) },
		{ name: 'Columns', fn: () => columnPack(items, W, H, rot) },
	];
	return methods
		.map((m) => {
			const r = m.fn();
			const off = largestEmptyRect(r.placed, W, H);
			const score: [number, number] = [r.placed.length, off ? offcutScore(off, W, H) : 0];
			return { name: m.name, placed: r.placed, unplaced: r.unplaced, offcut: off, score };
		})
		.sort((a, b) => b.score[0] - a.score[0] || b.score[1] - a.score[1]);
}

// Collapse a list of unplaced items back into Piece rows (grouped by label + real size).
export function overflowToPieces(unplaced: PackItem[]): Piece[] {
	const map = new Map<string, Piece>();
	for (const it of unplaced) {
		const key = `${it.label}|${it.rw}x${it.rh}`;
		const existing = map.get(key);
		if (existing) existing.qty++;
		else map.set(key, { name: it.label, w: it.rw, h: it.rh, qty: 1 });
	}
	return [...map.values()];
}
