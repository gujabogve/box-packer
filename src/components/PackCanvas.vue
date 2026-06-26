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
		maxHeight?: number;
	}>(),
	{ editable: true, maxHeight: 460 },
);

const emit = defineEmits<{
	change: [];
	stats: [{ placed: number; total: number; fill: number; offcut: Offcut | null }];
}>();

const wrap = ref<HTMLDivElement | null>(null);
const cv = ref<HTMLCanvasElement | null>(null);
const selected = ref(-1);

interface DragState {
	idx: number;
	ox: number;
	oy: number;
	moved: boolean;
}
let drag: DragState | null = null;
let lastTapTime = 0;
let lastTapIdx = -1;

function render(): void {
	const canvas = cv.value;
	const box = wrap.value;
	if (!canvas || !box) return;
	const W = Math.max(1, props.container.w);
	const H = Math.max(1, props.container.h);
	const maxW = Math.max(1, box.clientWidth);
	const offcut = largestEmptyRect(props.nodes, W, H);
	renderLayout(canvas, props.nodes, offcut, W, H, maxW, props.maxHeight, true, selected.value);
	const used = props.nodes.reduce((s, p) => s + p.w * p.h, 0);
	const fill = W * H > 0 ? (used / (W * H)) * 100 : 0;
	emit('stats', { placed: props.nodes.length, total: props.totalItems, fill: +fill.toFixed(1), offcut });
}

// Map a pointer event to real (container-unit) coordinates, independent of CSS scaling.
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

function onDown(e: PointerEvent): void {
	if (!props.editable) return;
	const { rx, ry } = toReal(e);
	const idx = pick(rx, ry);
	selected.value = idx;
	if (idx < 0) {
		render();
		return;
	}
	const p = props.nodes[idx];
	drag = { idx, ox: rx - p.x, oy: ry - p.y, moved: false };
	cv.value?.setPointerCapture(e.pointerId);
	render();
}

function onMove(e: PointerEvent): void {
	if (!drag || !props.editable) return;
	const { rx, ry } = toReal(e);
	const p = props.nodes[drag.idx];
	const W = props.container.w;
	const H = props.container.h;
	const rect = cv.value!.getBoundingClientRect();
	let nx = Math.max(0, Math.min(rx - drag.ox, W - p.w));
	let ny = Math.max(0, Math.min(ry - drag.oy, H - p.h));

	// snap to walls and to other pieces' edges
	const thx = (6 / rect.width) * W;
	const thy = (6 / rect.height) * H;
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

	p.x = Math.max(0, Math.min(nx, W - p.w));
	p.y = Math.max(0, Math.min(ny, H - p.h));
	drag.moved = true;
	render();
	emit('change');
}

function onUp(e: PointerEvent): void {
	cv.value?.releasePointerCapture?.(e.pointerId);
	if (drag && !drag.moved) {
		// a tap (no drag) — rotate on double-tap / double-click
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
	drag = null;
}

function rotate(idx: number): void {
	const p = props.nodes[idx];
	if (!p) return;
	[p.w, p.h] = [p.h, p.w];
	[p.rw, p.rh] = [p.rh, p.rw];
	p.rot = !p.rot;
	p.x = Math.max(0, Math.min(p.x, props.container.w - p.w));
	p.y = Math.max(0, Math.min(p.y, props.container.h - p.h));
	render();
	emit('change');
}

function rotateSelected(): void {
	if (selected.value >= 0) rotate(selected.value);
}

defineExpose({ rotateSelected });

let ro: ResizeObserver | null = null;
onMounted(() => {
	render();
	ro = new ResizeObserver(() => render());
	if (wrap.value) ro.observe(wrap.value);
});
onBeforeUnmount(() => ro?.disconnect());

watch(
	() => props.nodes,
	() => {
		selected.value = -1;
		render();
	},
);
watch(() => props.container, render, { deep: true });
watch(() => props.totalItems, render);
</script>

<template>
	<div ref="wrap" class="w-full">
		<canvas
			ref="cv"
			class="block max-w-full touch-none select-none rounded-lg border border-line bg-[#0d0f14]"
			@pointerdown="onDown"
			@pointermove="onMove"
			@pointerup="onUp"
			@pointercancel="onUp"
		/>
	</div>
</template>
