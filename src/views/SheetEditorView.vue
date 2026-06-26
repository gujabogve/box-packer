<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import PackCanvas from '../components/PackCanvas.vue';
import VariantCard from '../components/VariantCard.vue';
import { useProjectsStore } from '../stores/projects';
import type { Piece } from '../lib/types';
import { clone, largestEmptyRect, type Offcut, type PackItem, type PackNode } from '../lib/packer';
import { buildItems, growToFit, overflowToPieces, runMethods, type MethodCandidate } from '../lib/methods';

const props = defineProps<{ sheetId: string }>();
const store = useProjectsStore();
const router = useRouter();

const tab = ref<'setup' | 'layout'>('setup');
const note = ref('');

const sheet = computed(() => (store.activeProject ? store.getSheet(store.activeProject.id, props.sheetId) : null));

const PRESETS = [
	{ label: '122 × 244', w: 122, h: 244 },
	{ label: '152 × 152', w: 152, h: 152 },
];
const THICKNESSES = [4, 6, 9, 12, 15, 18, 25];

const thicknessOptions = computed(() => {
	const s = sheet.value;
	const set = new Set(THICKNESSES);
	if (s) set.add(s.thickness);
	return [...set].sort((a, b) => a - b);
});

function applyPreset(e: Event): void {
	const i = Number((e.target as HTMLSelectElement).value);
	const p = PRESETS[i];
	if (sheet.value && p) {
		sheet.value.container.w = p.w;
		sheet.value.container.h = p.h;
	}
	(e.target as HTMLSelectElement).value = '';
}

function addPiece(): void {
	sheet.value?.pieces.push({ name: '', w: 60, h: 40, qty: 1 } satisfies Piece);
}

function removePiece(i: number): void {
	sheet.value?.pieces.splice(i, 1);
}

// ---- packing / layout ----
interface ViewCandidate {
	name: string;
	placed: PackNode[];
	unplaced: PackItem[];
	offcut: Offcut | null;
	saved: boolean;
}

const candidates = shallowRef<MethodCandidate[]>([]);
const current = shallowRef<PackNode[]>([]);
const selectedName = ref('');
const edited = ref(false);
const packing = ref(false);
const stats = ref<{ placed: number; total: number; fill: number; offcut: Offcut | null }>({
	placed: 0,
	total: 0,
	fill: 0,
	offcut: null,
});
const packCanvas = ref<{ rotateSelected: () => void } | null>(null);
let lastKey = '';

const totalItems = computed(() =>
	sheet.value ? sheet.value.pieces.reduce((a, p) => a + Math.max(1, Math.floor(p.qty || 1)), 0) : 0,
);

function inputKey(): string {
	const s = sheet.value;
	return s ? JSON.stringify([s.container, s.options, s.pieces]) : '';
}

const savedCandidate = computed<ViewCandidate | null>(() => {
	const s = sheet.value;
	if (!s || !s.savedLayout || !s.savedLayout.length) return null;
	const placed = s.savedLayout as PackNode[];
	const offcut = largestEmptyRect(placed, Math.max(1, s.container.w), Math.max(1, s.container.h));
	return { name: s.savedMethod ? `Saved · ${s.savedMethod}` : 'Saved', placed, unplaced: [], offcut, saved: true };
});

const displayCandidates = computed<ViewCandidate[]>(() => {
	const list: ViewCandidate[] = candidates.value.map((c) => ({
		name: c.name,
		placed: c.placed,
		unplaced: c.unplaced,
		offcut: c.offcut,
		saved: false,
	}));
	const sc = savedCandidate.value;
	return sc ? [sc, ...list] : list;
});

const selectedCandidate = computed(() => displayCandidates.value.find((c) => c.name === selectedName.value) ?? null);
const overflow = computed(() =>
	selectedCandidate.value && !selectedCandidate.value.saved ? selectedCandidate.value.unplaced : [],
);

function caption(c: ViewCandidate): string {
	const s = sheet.value;
	if (!s) return '';
	const o = c.offcut;
	const off = o ? `${Math.round(o.w)}×${Math.round(o.h)}` : '—';
	const used = c.placed.reduce((sum, p) => sum + p.w * p.h, 0);
	const area = Math.max(1, s.container.w * s.container.h);
	const fill = Math.round((used / area) * 100);
	const left = !c.saved && c.unplaced.length ? ` · ${c.unplaced.length} left` : '';
	return `offcut ${off} · ${fill}%${left}`;
}

function selectByName(name: string): void {
	selectedName.value = name;
	const c = displayCandidates.value.find((x) => x.name === name);
	current.value = c ? clone(c.placed) : [];
	edited.value = false;
}

async function doPack(): Promise<void> {
	const s = sheet.value;
	if (!s || !s.pieces.length) {
		candidates.value = [];
		current.value = [];
		return;
	}
	packing.value = true;
	await new Promise((r) => setTimeout(r, 0)); // let the spinner paint before the blocking search
	const W = Math.max(1, s.container.w);
	let H = Math.max(1, s.container.h);
	const items = buildItems(s);
	if (s.options.grow) {
		H = growToFit(items, W, H, s.options.allowRotate);
		s.container.h = H;
	}
	candidates.value = runMethods(items, W, H, s.options.allowRotate);
	lastKey = inputKey();
	packing.value = false;
	selectByName(savedCandidate.value ? savedCandidate.value.name : (displayCandidates.value[0]?.name ?? ''));
}

function repack(): void {
	void doPack();
}

function onStats(s: { placed: number; total: number; fill: number; offcut: Offcut | null }): void {
	stats.value = s;
}

function onChange(): void {
	edited.value = true;
}

async function save(): Promise<void> {
	const s = sheet.value;
	if (!s) return;
	s.savedLayout = clone(current.value);
	s.savedMethod = edited.value ? 'Manual' : selectedName.value.replace(/^Saved · /, '');
	if (store.activeProject) await store.persist(store.activeProject.id);
	note.value = 'Layout saved.';
	selectedName.value = savedCandidate.value?.name ?? selectedName.value;
}

async function moveOverflow(): Promise<void> {
	const s = sheet.value;
	if (!s || !store.activeProject || !overflow.value.length) return;
	const pieces = overflowToPieces(overflow.value);
	const ns = await store.addSheet(store.activeProject.id, {
		name: `${s.name} (overflow)`,
		container: { ...s.container },
		thickness: s.thickness,
		options: { ...s.options },
		pieces,
	});
	if (ns) router.push(`/sheets/${ns.id}`);
}

// Pack when the Layout tab opens and inputs have changed since the last pack.
watch(
	() => tab.value,
	(t) => {
		if (t === 'layout' && sheet.value && (inputKey() !== lastKey || !candidates.value.length)) void doPack();
	},
);
// Re-pack on packing-option changes while viewing the layout.
watch(
	() => sheet.value?.options,
	() => {
		if (tab.value === 'layout') void doPack();
	},
	{ deep: true },
);

// ---- autosave (sheet setup) ----
let timer: number | undefined;
function flush(): void {
	if (store.activeProject) void store.persist(store.activeProject.id);
}
watch(
	sheet,
	() => {
		if (!store.activeProject) return;
		clearTimeout(timer);
		timer = window.setTimeout(flush, 300);
	},
	{ deep: true },
);
onBeforeUnmount(() => {
	clearTimeout(timer);
	flush();
});

const round = (n: number): number => Math.round(n);
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader :title="sheet ? sheet.name : 'Sheet'" back />

		<div v-if="!sheet" class="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
			Sheet not found.
		</div>

		<template v-else>
			<!-- Setup / Layout segmented control (mobile only; desktop shows both panes) -->
			<div class="flex gap-1 border-b border-line p-2 lg:hidden">
				<button
					v-for="t in ['setup', 'layout'] as const"
					:key="t"
					class="flex-1 rounded-md py-1.5 text-sm font-medium capitalize"
					:class="tab === t ? 'bg-accent text-white' : 'text-muted'"
					@click="tab = t"
				>
					{{ t }}
				</button>
			</div>

			<div class="flex flex-1 flex-col overflow-hidden lg:flex-row">
				<!-- SETUP -->
				<div
					class="flex-col flex-1 overflow-y-auto p-3 lg:flex lg:w-80 lg:flex-none lg:border-r lg:border-line"
					:class="tab === 'setup' ? 'flex' : 'hidden'"
				>
					<label class="mb-1 block text-xs text-muted">Sheet name</label>
					<input
						v-model="sheet.name"
						type="text"
						class="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
					/>

					<div class="mb-1 flex items-center justify-between">
						<label class="text-xs text-muted">Container (cm)</label>
						<select class="rounded border border-line bg-surface px-2 py-0.5 text-xs text-muted" @change="applyPreset">
							<option value="">Preset…</option>
							<option v-for="(p, i) in PRESETS" :key="p.label" :value="i">{{ p.label }}</option>
						</select>
					</div>
					<div class="mb-4 grid grid-cols-3 gap-2">
						<div>
							<span class="text-[11px] text-muted">Width</span>
							<input
								v-model.number="sheet.container.w"
								type="number"
								min="1"
								class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div>
							<span class="text-[11px] text-muted">Height</span>
							<input
								v-model.number="sheet.container.h"
								type="number"
								min="1"
								class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div>
							<span class="text-[11px] text-muted">Thickness</span>
							<select
								v-model.number="sheet.thickness"
								class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
							>
								<option v-for="t in thicknessOptions" :key="t" :value="t">{{ t }}mm</option>
							</select>
						</div>
					</div>

					<label class="mb-1 block text-xs text-muted">Pieces (cm)</label>
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left text-[11px] text-muted">
								<th class="pb-1 font-medium">Name</th>
								<th class="pb-1 font-medium">W</th>
								<th class="pb-1 font-medium">H</th>
								<th class="pb-1 font-medium">Qty</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="(pc, i) in sheet.pieces" :key="i" class="border-t border-line">
								<td class="py-1 pr-1">
									<input
										v-model="pc.name"
										type="text"
										placeholder="Back panel"
										class="w-full rounded border border-line bg-surface px-2 py-1.5 outline-none focus:border-accent"
									/>
								</td>
								<td class="py-1 pr-1">
									<input
										v-model.number="pc.w"
										type="number"
										min="1"
										class="w-14 rounded border border-line bg-surface px-1.5 py-1.5 outline-none focus:border-accent"
									/>
								</td>
								<td class="py-1 pr-1">
									<input
										v-model.number="pc.h"
										type="number"
										min="1"
										class="w-14 rounded border border-line bg-surface px-1.5 py-1.5 outline-none focus:border-accent"
									/>
								</td>
								<td class="py-1 pr-1">
									<input
										v-model.number="pc.qty"
										type="number"
										min="1"
										class="w-12 rounded border border-line bg-surface px-1.5 py-1.5 outline-none focus:border-accent"
									/>
								</td>
								<td class="py-1 text-right">
									<button class="px-1 text-[#ff6b6b]" aria-label="Remove" @click="removePiece(i)">×</button>
								</td>
							</tr>
						</tbody>
					</table>
					<button
						class="mt-3 w-full rounded-md border border-line py-2 text-sm text-ink active:border-muted"
						@click="addPiece"
					>
						+ Add piece
					</button>
				</div>

				<!-- LAYOUT -->
				<div class="flex-col flex-1 overflow-hidden lg:flex" :class="tab === 'layout' ? 'flex' : 'hidden'">
					<!-- options bar -->
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2 text-xs text-muted">
						<label class="flex items-center gap-1"
							><input v-model="sheet.options.allowRotate" type="checkbox" /> Rotate</label
						>
						<label class="flex items-center gap-1"
							><input v-model="sheet.options.useKerf" type="checkbox" /> Kerf</label
						>
						<input
							v-if="sheet.options.useKerf"
							v-model.number="sheet.options.kerf"
							type="number"
							step="any"
							min="0"
							class="w-16 rounded border border-line bg-surface px-1.5 py-1 outline-none focus:border-accent"
						/>
						<label class="flex items-center gap-1"><input v-model="sheet.options.grow" type="checkbox" /> Grow H</label>
						<button class="ml-auto rounded bg-accent px-3 py-1 font-semibold text-white" @click="repack">
							Re-pack
						</button>
					</div>

					<div
						v-if="!sheet.pieces.length"
						class="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted"
					>
						Add some pieces in the Setup tab first.
					</div>

					<template v-else>
						<!-- variant strip -->
						<div class="flex gap-2 overflow-x-auto border-b border-line p-2">
							<VariantCard
								v-for="c in displayCandidates"
								:key="c.name"
								:name="c.name"
								:placed="c.placed"
								:offcut="c.offcut"
								:container="sheet.container"
								:caption="caption(c)"
								:active="c.name === selectedName"
								@click="selectByName(c.name)"
							/>
							<p v-if="!displayCandidates.length && !packing" class="self-center px-2 text-xs text-muted">
								No layouts.
							</p>
						</div>

						<!-- editable canvas + stats -->
						<div class="flex-1 overflow-auto p-3">
							<div v-if="packing" class="flex h-40 items-center justify-center text-sm text-muted">Packing…</div>
							<PackCanvas
								v-else
								ref="packCanvas"
								:nodes="current"
								:container="sheet.container"
								:total-items="totalItems"
								@stats="onStats"
								@change="onChange"
							/>

							<div class="mt-2 text-sm text-muted">
								Placed <b class="text-ink">{{ stats.placed }}</b
								>/{{ stats.total }} · Fill <b class="text-ink">{{ stats.fill }}%</b>
								<span v-if="stats.offcut">
									· Offcut <b class="text-ink">{{ round(stats.offcut.w) }}×{{ round(stats.offcut.h) }}</b> cm</span
								>
							</div>
							<p class="text-[11px] text-muted/60">drag to move · double-tap to rotate · snaps to edges</p>

							<div v-if="overflow.length" class="mt-2 rounded-md border border-[#ffb454] p-2 text-xs text-[#ffb454]">
								{{ overflow.length }} piece(s) didn't fit.
								<button class="ml-1 font-semibold underline" @click="moveOverflow">Move to a new sheet →</button>
							</div>
						</div>

						<!-- action bar -->
						<div class="flex flex-col gap-1 border-t border-line p-3">
							<div class="flex gap-2">
								<button
									class="flex-1 rounded-md border border-line py-2.5 text-sm active:border-muted"
									@click="packCanvas?.rotateSelected()"
								>
									Rotate selected
								</button>
								<button class="flex-1 rounded-md bg-accent py-2.5 text-sm font-semibold text-white" @click="save">
									Save layout
								</button>
							</div>
							<p v-if="note" class="text-center text-xs text-[#3ddc84]">{{ note }}</p>
						</div>
					</template>
				</div>
			</div>
		</template>
	</div>
</template>
