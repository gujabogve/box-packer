<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { largestEmptyRect, type Offcut, type PackNode } from '../lib/packer';
import { renderLayout } from '../lib/render';

const props = withDefaults(
	defineProps<{
		nodes: PackNode[];
		container: { w: number; h: number };
		totalItems: number;
		editable?: boolean;
	}>(),
	{ editable: true },
);

const emit = defineEmits<{
	change: [];
	stats: [{ placed: number; total: number; fill: number; offcut: Offcut | null }];
}>();

const wrap = ref<HTMLDivElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
const selected = ref(-1);

// view transform (applied to the canvas via CSS; coordinate mapping reads getBoundingClientRect,
// which already reflects it, so piece-dragging keeps working at any zoom/pan)
const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface DragState {
	idx: number;
	ox: number;
	oy: number;
	moved: boolean;
}
type Mode = 'idle' | 'piece' | 'pan' | 'pinch';
let mode: Mode = 'idle';
let drag: DragState | null = null;
let panStart: { cx: number; cy: number; px: number; py: number } | null = null;
let pinch: { dist: number | null; mx: number; my: number } | null = null;
const pointers = new Map<number, { x: number; y: number }>();
let lastTapTime = 0;
let lastTapIdx = -1;

function clampPan(): void {
	const canvas = cv.value;
	const box = wrap.value;
	if (!canvas || !box) return;
	const vw = box.clientWidth;
	const vh = box.clientHeight;
	const sw = canvas.width * zoom.value;
	const sh = canvas.height * zoom.value;
	panX.value = sw <= vw ? (vw - sw) / 2 : clamp(panX.value, vw - sw, 0);
	panY.value = sh <= vh ? (vh - sh) / 2 : clamp(panY.value, vh - sh, 0);
}

function render(): void {
	const canvas = cv.value;
	const box = wrap.value;
	if (!canvas || !box) return;
	const W = Math.max(1, props.container.w);
	const H = Math.max(1, props.container.h);
	const offcut = largestEmptyRect(props.nodes, W, H);
	renderLayout(canvas, props.nodes, offcut, W, H, box.clientWidth, box.clientHeight, true, selected.value);
	clampPan();
	const used = props.nodes.reduce((s, p) => s + p.w * p.h, 0);
	const fill = W * H > 0 ? (used / (W * H)) * 100 : 0;
	emit('stats', { placed: props.nodes.length, total: props.totalItems, fill: +fill.toFixed(1), offcut });
}

// pointer (clientX/Y) → real container-unit coordinates, independent of zoom/pan/CSS scaling
function toReal(e: PointerEvent): { rx: number; ry: number } {
	const rect = cv.value!.getBoundingClientRect();
	return {
		rx: ((e.clientX - rect.left) / rect.width) * props.container.w,
		ry: ((e.clientY - rect.top) / rect.height) * props.container.h,
	};
}

function pick(rx: number, ry: number): number {
	for (let i = props.nodes.length - 1; i >= 0; i--) {
		const p = props.nodes[i];
		const w = p.rw ?? p.w;
		const h = p.rh ?? p.h;
		if (rx >= p.x && rx <= p.x + w && ry >= p.y && ry <= p.y + h) return i;
	}
	return -1;
}

function zoomAround(mx: number, my: number, factor: number): void {
	const nz = clamp(zoom.value * factor, 1, 6);
	panX.value = mx - (mx - panX.value) * (nz / zoom.value);
	panY.value = my - (my - panY.value) * (nz / zoom.value);
	zoom.value = nz;
	clampPan();
}

function zoomBy(factor: number): void {
	const box = wrap.value;
	if (box) zoomAround(box.clientWidth / 2, box.clientHeight / 2, factor);
}

function fit(): void {
	zoom.value = 1;
	panX.value = 0;
	panY.value = 0;
	clampPan();
}

function onDown(e: PointerEvent): void {
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

	if (pointers.size >= 2) {
		mode = 'pinch';
		drag = null;
		pinch = { dist: null, mx: 0, my: 0 };
		return;
	}
	if (!props.editable) {
		mode = 'pan';
		panStart = { cx: e.clientX, cy: e.clientY, px: panX.value, py: panY.value };
		return;
	}
	const { rx, ry } = toReal(e);
	const idx = pick(rx, ry);
	selected.value = idx;
	if (idx >= 0) {
		const p = props.nodes[idx];
		mode = 'piece';
		drag = { idx, ox: rx - p.x, oy: ry - p.y, moved: false };
	} else {
		mode = 'pan';
		panStart = { cx: e.clientX, cy: e.clientY, px: panX.value, py: panY.value };
	}
	render();
}

function onMove(e: PointerEvent): void {
	if (!pointers.has(e.pointerId)) return;
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

	if (mode === 'pinch' && pointers.size >= 2) {
		const box = wrap.value!;
		const r = box.getBoundingClientRect();
		const pts = [...pointers.values()];
		const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
		const mx = (pts[0].x + pts[1].x) / 2 - r.left;
		const my = (pts[0].y + pts[1].y) / 2 - r.top;
		if (pinch && pinch.dist != null) {
			zoomAround(mx, my, dist / pinch.dist);
			panX.value += mx - pinch.mx;
			panY.value += my - pinch.my;
			clampPan();
		}
		pinch = { dist, mx, my };
		return;
	}
	if (mode === 'pan' && panStart) {
		panX.value = panStart.px + (e.clientX - panStart.cx);
		panY.value = panStart.py + (e.clientY - panStart.cy);
		clampPan();
		return;
	}
	if (mode === 'piece' && drag) {
		const { rx, ry } = toReal(e);
		const p = props.nodes[drag.idx];
		const W = props.container.w;
		const H = props.container.h;
		const rect = cv.value!.getBoundingClientRect();
		let nx = clamp(rx - drag.ox, 0, W - p.w);
		let ny = clamp(ry - drag.oy, 0, H - p.h);
		const thx = (8 / rect.width) * W;
		const thy = (8 / rect.height) * H;
		const xc = [0, W - p.w];
		const yc = [0, H - p.h];
		for (let i = 0; i < props.nodes.length; i++) {
			if (i === drag.idx) continue;
			const q = props.nodes[i];
			xc.push(q.x, q.x - p.w, q.x + q.w, q.x + q.w - p.w);
			yc.push(q.y, q.y - p.h, q.y + q.h, q.y + q.h - p.h);
		}
		for (const c of xc)
			if (Math.abs(nx - c) < thx) {
				nx = c;
				break;
			}
		for (const c of yc)
			if (Math.abs(ny - c) < thy) {
				ny = c;
				break;
			}
		p.x = clamp(nx, 0, W - p.w);
		p.y = clamp(ny, 0, H - p.h);
		drag.moved = true;
		render();
		emit('change');
	}
}

function onUp(e: PointerEvent): void {
	(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	pointers.delete(e.pointerId);

	if (mode === 'piece' && drag && !drag.moved) {
		const now = performance.now();
		if (now - lastTapTime < 300 && lastTapIdx === drag.idx) {
			rotate(drag.idx);
			lastTapTime = 0;
			lastTapIdx = -1;
		} else {
			lastTapTime = now;
			lastTapIdx = drag.idx;
		}
	}

	if (pointers.size === 0) {
		mode = 'idle';
		drag = null;
		panStart = null;
		pinch = null;
	} else if (mode === 'pinch') {
		// dropped from 2→1 finger: wait for full lift before resuming
		mode = 'idle';
	}
}

function rotate(idx: number): void {
	const p = props.nodes[idx];
	if (!p) return;
	[p.w, p.h] = [p.h, p.w];
	[p.rw, p.rh] = [p.rh, p.rw];
	p.rot = !p.rot;
	p.x = clamp(p.x, 0, props.container.w - p.w);
	p.y = clamp(p.y, 0, props.container.h - p.h);
	render();
	emit('change');
}

function rotateSelected(): void {
	if (selected.value >= 0) rotate(selected.value);
}

defineExpose({ rotateSelected, fit });

let ro: ResizeObserver | null = null;
onMounted(() => {
	render();
	fit();
	ro = new ResizeObserver(() => render());
	if (wrap.value) ro.observe(wrap.value);
});
onBeforeUnmount(() => ro?.disconnect());

watch(
	() => props.nodes,
	() => {
		selected.value = -1;
		render();
		fit();
	},
);
watch(
	() => props.container,
	() => render(),
	{ deep: true },
);
watch(
	() => props.totalItems,
	() => render(),
);
</script>

<template>
	<div
		ref="wrap"
		class="relative w-full touch-none select-none overflow-hidden rounded-lg border border-line bg-[#0d0f14]"
		style="min-height: 200px"
		@pointerdown="onDown"
		@pointermove="onMove"
		@pointerup="onUp"
		@pointercancel="onUp"
	>
		<canvas
			ref="cv"
			class="absolute left-0 top-0 origin-top-left"
			:style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }"
		/>
		<div
			class="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-line bg-panel/85 p-1 text-xs backdrop-blur"
			@pointerdown.stop
		>
			<button class="h-7 w-7 rounded text-base text-ink" aria-label="Zoom out" @click="zoomBy(0.8)">−</button>
			<button class="rounded px-2 text-muted" aria-label="Fit" @click="fit">Fit</button>
			<button class="h-7 w-7 rounded text-base text-ink" aria-label="Zoom in" @click="zoomBy(1.25)">+</button>
		</div>
	</div>
</template>
