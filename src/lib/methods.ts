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
import type { Piece, Project, SheetOptions } from './types';

export interface MethodCandidate {
	name: string;
	placed: PackNode[];
	unplaced: PackItem[];
	offcut: Offcut | null;
	score: [number, number];
}

function kerfOf(options: SheetOptions): number {
	return options.useKerf ? Math.max(0, options.kerf || 0) : 0;
}

// Expand a piece list into individual items. `multiplier` repeats the whole list (e.g. N products).
// Footprint (w/h) includes kerf; real cut size is kept as rw/rh. Colors stay stable per piece.
export function expandItems(pieces: Piece[], multiplier: number, kerf: number): PackItem[] {
	const items: PackItem[] = [];
	const mult = Math.max(1, Math.floor(multiplier || 1));
	pieces.forEach((b, gi) => {
		const qty = Math.max(1, Math.floor(b.qty || 1)) * mult;
		for (let q = 0; q < qty; q++) {
			items.push({
				w: b.w + kerf,
				h: b.h + kerf,
				rw: b.w,
				rh: b.h,
				color: b.color ?? PALETTE[gi % PALETTE.length],
				label: b.name.trim() || `${b.w}×${b.h}`,
			});
		}
	});
	return items;
}

// Run all five methods on one board, sorted best-first by [placed count, offcut score].
export function runMethods(
	items: PackItem[],
	W: number,
	H: number,
	rot: boolean,
	searchIters = 5000,
): MethodCandidate[] {
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

// Group placed nodes back into Piece rows (by label + real size + colour).
export function groupToPieces(placed: PackNode[]): Piece[] {
	const map = new Map<string, Piece>();
	for (const p of placed) {
		const key = `${p.label}|${p.rw}x${p.rh}|${p.color}`;
		const existing = map.get(key);
		if (existing) existing.qty++;
		else map.set(key, { name: p.label, w: p.rw, h: p.rh, qty: 1, color: p.color });
	}
	return [...map.values()];
}

export interface PlannedSheet {
	pieces: Piece[];
	placed: PackNode[];
}

// Distribute `quantity` products' worth of parts across as many boards as needed (greedy multi-bin).
// Returns one PlannedSheet per board, plus the count of items that don't fit any board at all.
export function planSheets(
	parts: Piece[],
	quantity: number,
	container: { w: number; h: number },
	options: SheetOptions,
): { sheets: PlannedSheet[]; leftover: number } {
	const W = Math.max(1, container.w);
	const H = Math.max(1, container.h);
	const rot = options.allowRotate;
	let remaining = expandItems(parts, quantity, kerfOf(options));
	const sheets: PlannedSheet[] = [];
	let guard = 0;
	while (remaining.length && guard++ < 500) {
		const r = maxrectsBest(remaining, W, H, rot, true);
		if (!r.placed.length) break; // a single part is larger than the board
		sheets.push({ pieces: groupToPieces(r.placed), placed: r.placed });
		remaining = r.unplaced;
	}
	return { sheets, leftover: remaining.length };
}

// Largest number of whole products that fit on a single board.
export function maxProductsPerBoard(
	parts: Piece[],
	container: { w: number; h: number },
	options: SheetOptions,
): number {
	if (!parts.length) return 0;
	const W = Math.max(1, container.w);
	const H = Math.max(1, container.h);
	const rot = options.allowRotate;
	const kerf = kerfOf(options);
	let fits = 0;
	for (let n = 1; n <= 100; n++) {
		if (maxrectsBest(expandItems(parts, n, kerf), W, H, rot, true).unplaced.length === 0) fits = n;
		else break;
	}
	return fits;
}

// Convenience wrappers operating on a whole project.
export function planProject(project: Project): { sheets: PlannedSheet[]; leftover: number } {
	return planSheets(project.parts, project.quantity, project.container, project.options);
}

export function capacityOf(project: Project): number {
	return maxProductsPerBoard(project.parts, project.container, project.options);
}
