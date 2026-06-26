<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import PackCanvas from '../components/PackCanvas.vue';
import VariantCard from '../components/VariantCard.vue';
import { useProjectsStore } from '../stores/projects';
import { clone, largestEmptyRect, type Offcut, type PackItem, type PackNode } from '../lib/packer';
import { expandItems, runMethods, type MethodCandidate } from '../lib/methods';

const props = defineProps<{ sheetId: string }>();
const store = useProjectsStore();

const note = ref('');
const variantsOpen = ref(true);

const project = computed(() => store.activeProject);
const sheet = computed(() => (project.value ? store.getSheet(project.value.id, props.sheetId) : null));

const kerf = computed(() => (project.value?.options.useKerf ? Math.max(0, project.value.options.kerf || 0) : 0));
const totalItems = computed(() =>
	sheet.value ? sheet.value.pieces.reduce((a, p) => a + Math.max(1, Math.floor(p.qty || 1)), 0) : 0,
);

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

const savedCandidate = computed<ViewCandidate | null>(() => {
	const s = sheet.value;
	const p = project.value;
	if (!s || !p || !s.savedLayout || !s.savedLayout.length) return null;
	const placed = s.savedLayout as PackNode[];
	const offcut = largestEmptyRect(placed, Math.max(1, p.container.w), Math.max(1, p.container.h));
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

function caption(c: ViewCandidate): string {
	const p = project.value;
	if (!p) return '';
	const o = c.offcut;
	const off = o ? `${Math.round(o.w)}×${Math.round(o.h)}` : '—';
	const used = c.placed.reduce((sum, n) => sum + n.w * n.h, 0);
	const fill = Math.round((used / Math.max(1, p.container.w * p.container.h)) * 100);
	return `offcut ${off} · ${fill}%`;
}

function selectByName(name: string): void {
	selectedName.value = name;
	const c = displayCandidates.value.find((x) => x.name === name);
	current.value = c ? clone(c.placed) : [];
	edited.value = false;
}

async function doPack(): Promise<void> {
	const s = sheet.value;
	const p = project.value;
	if (!s || !p || !s.pieces.length) {
		candidates.value = [];
		current.value = [];
		return;
	}
	packing.value = true;
	await new Promise((r) => setTimeout(r, 0));
	const W = Math.max(1, p.container.w);
	const H = Math.max(1, p.container.h);
	candidates.value = runMethods(expandItems(s.pieces, 1, kerf.value), W, H, p.options.allowRotate);
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
	const p = project.value;
	if (!s || !p) return;
	s.savedLayout = clone(current.value);
	s.savedMethod = edited.value ? 'Manual' : selectedName.value.replace(/^Saved · /, '');
	await store.persist(p.id);
	note.value = 'Layout saved.';
	selectedName.value = savedCandidate.value?.name ?? selectedName.value;
}

onMounted(doPack);
watch(() => props.sheetId, doPack);
watch(() => project.value?.options, doPack, { deep: true });

// persist option/layout edits made here
let timer: number | undefined;
watch(
	project,
	() => {
		const p = project.value;
		if (!p) return;
		clearTimeout(timer);
		timer = window.setTimeout(() => void store.persist(p.id), 300);
	},
	{ deep: true },
);
onBeforeUnmount(() => clearTimeout(timer));

const round = (n: number): number => Math.round(n);
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader :title="sheet ? sheet.name : 'Sheet'" back />

		<div v-if="!project || !sheet" class="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
			Sheet not found.
		</div>

		<div v-else class="flex flex-1 flex-col overflow-hidden">
			<!-- options -->
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-2 text-xs text-muted">
				<label class="flex items-center gap-1"
					><input v-model="project.options.allowRotate" type="checkbox" /> Rotate</label
				>
				<label class="flex items-center gap-1"><input v-model="project.options.useKerf" type="checkbox" /> Kerf</label>
				<input
					v-if="project.options.useKerf"
					v-model.number="project.options.kerf"
					type="number"
					step="any"
					min="0"
					class="w-16 rounded border border-line bg-surface px-1.5 py-1 outline-none focus:border-accent"
				/>
				<button class="ml-auto rounded bg-accent px-3 py-1 font-semibold text-white" @click="repack">Re-pack</button>
			</div>

			<!-- variants (collapsible) -->
			<div class="shrink-0 border-b border-line">
				<button
					class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted"
					@click="variantsOpen = !variantsOpen"
				>
					<span class="w-3">{{ variantsOpen ? '▾' : '▸' }}</span>
					<span>Variants ({{ displayCandidates.length }})</span>
					<span v-if="selectedName" class="ml-auto truncate pl-2 text-ink">{{ selectedName }}</span>
				</button>
				<div v-show="variantsOpen" class="flex gap-2 overflow-x-auto px-2 pb-2">
					<VariantCard
						v-for="c in displayCandidates"
						:key="c.name"
						:name="c.name"
						:placed="c.placed"
						:offcut="c.offcut"
						:container="project.container"
						:caption="caption(c)"
						:active="c.name === selectedName"
						@click="selectByName(c.name)"
					/>
					<p v-if="!displayCandidates.length && !packing" class="self-center px-2 text-xs text-muted">No layouts.</p>
				</div>
			</div>

			<!-- editable canvas (fills) + stats -->
			<div class="flex min-h-0 flex-1 flex-col p-3">
				<div v-if="packing" class="flex flex-1 items-center justify-center text-sm text-muted">Packing…</div>
				<PackCanvas
					v-else
					ref="packCanvas"
					class="min-h-0 flex-1"
					:nodes="current"
					:container="project.container"
					:total-items="totalItems"
					@stats="onStats"
					@change="onChange"
				/>

				<div class="mt-2 shrink-0 text-sm text-muted">
					Placed <b class="text-ink">{{ stats.placed }}</b
					>/{{ stats.total }} · Fill <b class="text-ink">{{ stats.fill }}%</b>
					<span v-if="stats.offcut">
						· Offcut <b class="text-ink">{{ round(stats.offcut.w) }}×{{ round(stats.offcut.h) }}</b> cm</span
					>
				</div>
			</div>

			<!-- actions -->
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
		</div>
	</div>
</template>
