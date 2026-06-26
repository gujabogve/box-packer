// 2D rectangle packing engine — ported verbatim from the original single-file prototype,
// typed and split out as a pure (DOM-free) module. Logic is unchanged.

export interface PackItem {
	w: number;
	h: number;
	rw: number;
	rh: number;
	color: string;
	label: string;
}

export interface PackNode {
	x: number;
	y: number;
	w: number;
	h: number;
	rw: number;
	rh: number;
	color: string;
	label: string;
	rot: boolean;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Offcut extends Rect {
	area: number;
}

export interface PackResult {
	placed: PackNode[];
	unplaced: PackItem[];
}

export interface Candidate {
	placed: PackNode[];
	unplaced: PackItem[];
	score: [number, number];
}

export const PALETTE = ['#4f9dff', '#ff7a59', '#46c896', '#c084fc', '#ffd166', '#ef476f', '#06d6a0', '#f78c6b'];

// MaxRects packing (Best Short Side Fit). Returns placements + leftovers.
export function pack(items: PackItem[], W: number, H: number, allowRotate: boolean): PackResult {
	let free: Rect[] = [{ x: 0, y: 0, w: W, h: H }];
	const placed: PackNode[] = [];
	const unplaced: PackItem[] = [];

	for (const it of items) {
		let best: { w: number; h: number; x: number; y: number; score: number; rot: boolean } | null = null;
		for (const f of free) {
			if (it.w <= f.w && it.h <= f.h) {
				const leftover = Math.min(f.w - it.w, f.h - it.h);
				if (!best || leftover < best.score) best = { w: it.w, h: it.h, x: f.x, y: f.y, score: leftover, rot: false };
			}
			if (allowRotate && it.h <= f.w && it.w <= f.h) {
				const leftover = Math.min(f.w - it.h, f.h - it.w);
				if (!best || leftover < best.score) best = { w: it.h, h: it.w, x: f.x, y: f.y, score: leftover, rot: true };
			}
		}
		if (!best) {
			unplaced.push(it);
			continue;
		}

		const node: PackNode = {
			x: best.x,
			y: best.y,
			w: best.w,
			h: best.h,
			rw: best.rot ? it.rh : it.rw,
			rh: best.rot ? it.rw : it.rh,
			color: it.color,
			label: it.label,
			rot: best.rot,
		};
		placed.push(node);

		// split all free rects that overlap the placed node
		const next: Rect[] = [];
		for (const f of free) {
			if (node.x >= f.x + f.w || node.x + node.w <= f.x || node.y >= f.y + f.h || node.y + node.h <= f.y) {
				next.push(f);
				continue;
			}
			if (node.x > f.x) next.push({ x: f.x, y: f.y, w: node.x - f.x, h: f.h });
			if (node.x + node.w < f.x + f.w)
				next.push({ x: node.x + node.w, y: f.y, w: f.x + f.w - (node.x + node.w), h: f.h });
			if (node.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: node.y - f.y });
			if (node.y + node.h < f.y + f.h)
				next.push({ x: f.x, y: node.y + node.h, w: f.w, h: f.y + f.h - (node.y + node.h) });
		}
		// prune contained rects
		free = next.filter(
			(a, i) =>
				!next.some((b, j) => i !== j && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h),
		);
	}
	return { placed, unplaced };
}

// Usefulness of an offcut: raw area, bonus if it spans the full width or height (clean strip).
const SPAN_BONUS = 1.2;
export function offcutScore(r: Rect, W: number, H: number): number {
	let s = r.w * r.h;
	if (r.w >= W - 1e-6) s *= SPAN_BONUS;
	if (r.h >= H - 1e-6) s *= SPAN_BONUS;
	return s;
}

// Best empty axis-aligned rectangle (by offcutScore) via coordinate compression + histogram scan.
export function largestEmptyRect(placed: PackNode[], W: number, H: number): Offcut | null {
	const xs = [...new Set([0, W, ...placed.flatMap((p) => [p.x, p.x + p.w]).filter((v) => v > 0 && v < W)])].sort(
		(a, b) => a - b,
	);
	const ys = [...new Set([0, H, ...placed.flatMap((p) => [p.y, p.y + p.h]).filter((v) => v > 0 && v < H)])].sort(
		(a, b) => a - b,
	);
	const nx = xs.length - 1,
		ny = ys.length - 1;
	if (nx < 1 || ny < 1) return null;
	const cw = xs.slice(1).map((v, i) => v - xs[i]);
	const ch = ys.slice(1).map((v, i) => v - ys[i]);
	const occ = (i: number, j: number): boolean => {
		const cx = (xs[i] + xs[i + 1]) / 2,
			cy = (ys[j] + ys[j + 1]) / 2;
		return placed.some((p) => cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h);
	};
	const height = new Array<number>(nx).fill(0); // free height (real units) ending at current row
	let best: Offcut | null = null,
		bestScore = -1;
	for (let j = 0; j < ny; j++) {
		for (let i = 0; i < nx; i++) height[i] = occ(i, j) ? 0 : height[i] + ch[j];
		const rowBottom = ys[j + 1];
		for (let i = 0; i < nx; i++) {
			let minH = Infinity,
				width = 0;
			for (let k = i; k < nx; k++) {
				minH = Math.min(minH, height[k]);
				if (minH === 0) break;
				width += cw[k];
				const r: Offcut = { x: xs[i], y: rowBottom - minH, w: width, h: minH, area: minH * width };
				const sc = offcutScore(r, W, H);
				if (sc > bestScore) {
					bestScore = sc;
					best = r;
				}
			}
		}
	}
	return best;
}

type Cmp = (a: PackItem, b: PackItem) => number;
const SORTS: Cmp[] = [
	(a, b) => b.h - a.h || b.w - a.w, // tallest first
	(a, b) => b.w - a.w || b.h - a.h, // widest first
	(a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h), // longest side first
	(a, b) => b.w * b.h - a.w * a.h, // largest area first
];

// Slide every piece as far as possible along one axis to close internal gaps.
export function slide(placed: PackNode[], axis: 'x' | 'y', toMax: boolean, limit = 0): void {
	const s = axis === 'x' ? 'w' : 'h';
	const o = axis === 'x' ? 'y' : 'x';
	const os = axis === 'x' ? 'h' : 'w';
	const order = [...placed].sort((a, b) => (toMax ? b[axis] + b[s] - (a[axis] + a[s]) : a[axis] - b[axis]));
	for (const p of order) {
		const overlaps = (q: PackNode): boolean => q !== p && q[o] < p[o] + p[os] && q[o] + q[os] > p[o];
		if (!toMax) {
			let np = 0;
			for (const q of placed) if (overlaps(q) && q[axis] + q[s] <= p[axis] + 1e-9) np = Math.max(np, q[axis] + q[s]);
			p[axis] = np;
		} else {
			let np = limit - p[s];
			for (const q of placed) if (overlaps(q) && q[axis] >= p[axis] + p[s] - 1e-9) np = Math.min(np, q[axis] - p[s]);
			p[axis] = np;
		}
	}
}

export function clone(a: PackNode[]): PackNode[] {
	return a.map((p) => ({ ...p }));
}

// Remaining free rectangles of a layout (same split/prune as the packer).
export function freeRects(placed: PackNode[], W: number, H: number): Rect[] {
	let free: Rect[] = [{ x: 0, y: 0, w: W, h: H }];
	for (const node of placed) {
		const next: Rect[] = [];
		for (const f of free) {
			if (node.x >= f.x + f.w || node.x + node.w <= f.x || node.y >= f.y + f.h || node.y + node.h <= f.y) {
				next.push(f);
				continue;
			}
			if (node.x > f.x) next.push({ x: f.x, y: f.y, w: node.x - f.x, h: f.h });
			if (node.x + node.w < f.x + f.w)
				next.push({ x: node.x + node.w, y: f.y, w: f.x + f.w - (node.x + node.w), h: f.h });
			if (node.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: node.y - f.y });
			if (node.y + node.h < f.y + f.h)
				next.push({ x: f.x, y: node.y + node.h, w: f.w, h: f.y + f.h - (node.y + node.h) });
		}
		free = next.filter(
			(a, i) =>
				!next.some((b, j) => i !== j && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h),
		);
	}
	return free;
}

// Lift the deepest pieces into higher gaps so a clean edge strip can open up.
export function gapFill(placed: PackNode[], W: number, H: number): void {
	for (let guard = 0; guard < 40; guard++) {
		const free = freeRects(placed, W, H);
		const order = [...placed].sort((a, b) => b.y + b.h - (a.y + a.h));
		let moved = false;
		for (const p of order) {
			let target: Rect | null = null;
			for (const f of free) {
				if (f.w >= p.w - 1e-9 && f.h >= p.h - 1e-9 && f.y + p.h < p.y + p.h - 1e-9) {
					if (!target || f.y < target.y) target = f;
				}
			}
			if (target) {
				p.x = target.x;
				p.y = target.y;
				moved = true;
				break;
			}
		}
		if (!moved) break;
	}
}

interface Orient {
	w: number;
	h: number;
	rot: boolean;
}

// Orientation options for a piece (adds the rotated one when allowed).
function orients(it: PackItem, rot: boolean): Orient[] {
	const a: Orient = { w: it.w, h: it.h, rot: false };
	if (!rot || it.w === it.h) return [a];
	return [a, { w: it.h, h: it.w, rot: true }];
}

function mkNode(it: PackItem, x: number, y: number, o: Orient): PackNode {
	return {
		x,
		y,
		w: o.w,
		h: o.h,
		rw: o.rot ? it.rh : it.rw,
		rh: o.rot ? it.rw : it.rh,
		color: it.color,
		label: it.label,
		rot: o.rot,
	};
}

// MaxRects across all sort orders + corner compaction; optionally gap-fill. Returns best by [placed, offcut].
export function maxrectsBest(items: PackItem[], W: number, H: number, rot: boolean, useFill: boolean): Candidate {
	let best: Candidate | null = null;
	const consider = (placed: PackNode[], unplaced: PackItem[]): void => {
		const off = largestEmptyRect(placed, W, H);
		const score: [number, number] = [placed.length, off ? offcutScore(off, W, H) : 0];
		if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1]))
			best = { placed, unplaced, score };
	};
	for (const cmp of SORTS) {
		const r = pack([...items].sort(cmp), W, H, rot);
		const tl = clone(r.placed);
		slide(tl, 'x', false);
		slide(tl, 'y', false);
		slide(tl, 'x', false);
		const tr = clone(r.placed);
		slide(tr, 'x', true, W);
		slide(tr, 'y', false);
		slide(tr, 'x', true, W);
		for (let v of [tl, tr, r.placed]) {
			if (useFill) {
				v = clone(v);
				gapFill(v, W, H);
				slide(v, 'x', false);
				slide(v, 'y', false);
			}
			consider(v, r.unplaced);
		}
	}
	return best!;
}

// Randomized multi-restart search: try many orderings, compact each toward the top, keep the best offcut.
export function searchBest(items: PackItem[], W: number, H: number, rot: boolean, iters: number): Candidate {
	let best: Candidate | null = null;
	const consider = (placed: PackNode[], unplaced: PackItem[]): void => {
		const off = largestEmptyRect(placed, W, H);
		const score: [number, number] = [placed.length, off ? offcutScore(off, W, H) : 0];
		if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1]))
			best = { placed, unplaced, score };
	};
	const seed = maxrectsBest(items, W, H, rot, true); // start from the deterministic best
	consider(seed.placed, seed.unplaced);
	for (let n = 0; n < iters; n++) {
		const arr = [...items];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		const r = pack(arr, W, H, rot);
		const v = clone(r.placed);
		slide(v, 'y', false);
		slide(v, 'x', false);
		slide(v, 'y', false);
		consider(v, r.unplaced);
	}
	const winner = best!; // refine the winner with a gap-fill pass
	const v = clone(winner.placed);
	gapFill(v, W, H);
	slide(v, 'y', false);
	slide(v, 'x', false);
	consider(v, winner.unplaced);
	return best!;
}

// Shelf packer: rows top-down — leaves a clean full-width strip at the bottom.
export function shelfPack(items: PackItem[], W: number, H: number, rot: boolean): PackResult {
	const order = [...items].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
	const placed: PackNode[] = [],
		unplaced: PackItem[] = [];
	let x = 0,
		y = 0,
		rowH = 0;
	for (const it of order) {
		const os = orients(it, rot).filter((o) => o.w <= W + 1e-9);
		if (!os.length) {
			unplaced.push(it);
			continue;
		}
		const o = os.reduce((m, c) => (c.h < m.h ? c : m)); // lay flat
		if (x + o.w > W + 1e-9) {
			y += rowH;
			x = 0;
			rowH = 0;
		}
		if (y + o.h > H + 1e-9) {
			unplaced.push(it);
			continue;
		}
		placed.push(mkNode(it, x, y, o));
		x += o.w;
		rowH = Math.max(rowH, o.h);
	}
	return { placed, unplaced };
}

// Column packer: columns left-to-right — leaves a clean full-height strip on the side.
export function columnPack(items: PackItem[], W: number, H: number, rot: boolean): PackResult {
	const order = [...items].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
	const placed: PackNode[] = [],
		unplaced: PackItem[] = [];
	let x = 0,
		y = 0,
		colW = 0;
	for (const it of order) {
		const os = orients(it, rot).filter((o) => o.h <= H + 1e-9);
		if (!os.length) {
			unplaced.push(it);
			continue;
		}
		const o = os.reduce((m, c) => (c.w < m.w ? c : m)); // stand narrow
		if (y + o.h > H + 1e-9) {
			x += colW;
			y = 0;
			colW = 0;
		}
		if (x + o.w > W + 1e-9) {
			unplaced.push(it);
			continue;
		}
		placed.push(mkNode(it, x, y, o));
		y += o.h;
		colW = Math.max(colW, o.w);
	}
	return { placed, unplaced };
}
