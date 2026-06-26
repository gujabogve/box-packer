// Generates the PWA icons with zero dependencies: draws a small "packed sheet with a
// green offcut strip" mark and encodes PNGs by hand (IHDR/IDAT/IEND + CRC32 + zlib deflate).
// Run with: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([len, body, crc]);
}

function png(N, rgba) {
	const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(N, 0);
	ihdr.writeUInt32BE(N, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // RGBA
	const stride = N * 4;
	const raw = Buffer.alloc((stride + 1) * N);
	for (let y = 0; y < N; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
	const idat = deflateSync(raw, { level: 9 });
	return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// Layout in absolute pixels, kept identical between PNG and SVG output.
function shapes(N) {
	const m = N * 0.16;
	const bw = N - 2 * m;
	const bh = N - 2 * m;
	const px = (f) => m + f * bw;
	const py = (f) => m + f * bh;
	const pw = (f) => f * bw;
	const ph = (f) => f * bh;
	const t = Math.max(2, N * 0.012);
	const ox = px(0.76);
	const oy = py(0.08);
	const ow = pw(0.18);
	const oh = ph(0.84);
	return [
		{ x: 0, y: 0, w: N, h: N, c: '#0f1115' }, // full-bleed bg (maskable-safe)
		{ x: m, y: m, w: bw, h: bh, c: '#12151c' }, // the sheet
		{ x: px(0.06), y: py(0.08), w: pw(0.5), h: ph(0.4), c: '#4f9dff' },
		{ x: px(0.06), y: py(0.54), w: pw(0.3), h: ph(0.38), c: '#46c896' },
		{ x: px(0.4), y: py(0.54), w: pw(0.27), h: ph(0.38), c: '#ffd166' },
		{ x: px(0.6), y: py(0.08), w: pw(0.12), h: ph(0.4), c: '#ff7a59' },
		// green offcut strip outline
		{ x: ox, y: oy, w: ow, h: t, c: '#3ddc84' },
		{ x: ox, y: oy + oh - t, w: ow, h: t, c: '#3ddc84' },
		{ x: ox, y: oy, w: t, h: oh, c: '#3ddc84' },
		{ x: ox + ow - t, y: oy, w: t, h: oh, c: '#3ddc84' },
	];
}

function makePng(N) {
	const buf = Buffer.alloc(N * N * 4);
	for (const s of shapes(N)) {
		const [r, g, b] = hex(s.c);
		const X0 = Math.max(0, Math.round(s.x));
		const Y0 = Math.max(0, Math.round(s.y));
		const X1 = Math.min(N, Math.round(s.x + s.w));
		const Y1 = Math.min(N, Math.round(s.y + s.h));
		for (let y = Y0; y < Y1; y++)
			for (let x = X0; x < X1; x++) {
				const i = (y * N + x) * 4;
				buf[i] = r;
				buf[i + 1] = g;
				buf[i + 2] = b;
				buf[i + 3] = 255;
			}
	}
	return png(N, buf);
}

function makeSvg(N) {
	const rects = shapes(N)
		.map((s) => `<rect x="${+s.x.toFixed(2)}" y="${+s.y.toFixed(2)}" width="${+s.w.toFixed(2)}" height="${+s.h.toFixed(2)}" fill="${s.c}"/>`)
		.join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}">${rects}</svg>\n`;
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', makePng(192));
writeFileSync('public/icon-512.png', makePng(512));
writeFileSync('public/apple-touch-icon.png', makePng(180));
writeFileSync('public/favicon.svg', makeSvg(64));
console.log('icons written → public/{icon-192,icon-512,apple-touch-icon}.png, favicon.svg');
