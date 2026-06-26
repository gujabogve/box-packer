import type { Offcut, PackNode } from './packer';

// Render a layout into a canvas; returns the scale used. Ported from the original prototype,
// with an optional highlighted (selected) piece for the editable canvas.
export function renderLayout(
	canvas: HTMLCanvasElement,
	placed: PackNode[],
	offcut: Offcut | null,
	W: number,
	H: number,
	maxW: number,
	maxH: number,
	labels: boolean,
	selected = -1,
): number {
	const scale = Math.min(maxW / W, maxH / H, 4);
	canvas.width = Math.max(1, Math.round(W * scale));
	canvas.height = Math.max(1, Math.round(H * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) return scale;
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	for (let idx = 0; idx < placed.length; idx++) {
		const p = placed[idx];
		const x = p.x * scale,
			y = p.y * scale,
			w = (p.rw ?? p.w) * scale,
			h = (p.rh ?? p.h) * scale;
		ctx.fillStyle = p.color + 'cc';
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = idx === selected ? '#ffffff' : '#0d0f14';
		ctx.lineWidth = idx === selected ? 2 : 1;
		ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
		if (labels && w > 30 && h > 16) {
			ctx.fillStyle = '#fff';
			ctx.font = '11px system-ui';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(p.label + (p.rot ? ' ⟳' : ''), x + w / 2, y + h / 2);
		}
	}

	if (offcut && offcut.w > 0 && offcut.h > 0) {
		const x = offcut.x * scale,
			y = offcut.y * scale,
			w = offcut.w * scale,
			h = offcut.h * scale;
		ctx.fillStyle = 'rgba(255,255,255,0.06)';
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = '#3ddc84';
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
		ctx.setLineDash([]);
		if (labels && w > 40 && h > 18) {
			ctx.fillStyle = '#3ddc84';
			ctx.font = 'bold 12px system-ui';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`offcut ${+offcut.w.toFixed(1)}×${+offcut.h.toFixed(1)}`, x + w / 2, y + h / 2);
		}
	}
	return scale;
}
