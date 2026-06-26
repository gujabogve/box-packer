<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import VariantCard from '../components/VariantCard.vue';
import { useProjectsStore } from '../stores/projects';
import type { Piece, Sheet } from '../lib/types';
import { capacityOf } from '../lib/methods';
import { largestEmptyRect, type Offcut } from '../lib/packer';

const store = useProjectsStore();
const router = useRouter();

const project = computed(() => store.activeProject);

const PRESETS = [
	{ label: '122 × 244', w: 122, h: 244 },
	{ label: '152 × 152', w: 152, h: 152 },
];
const THICKNESSES = [4, 6, 9, 12, 15, 18, 25];

const capacity = ref<number | null>(null);
const busy = ref(false);
const note = ref('');

const thicknessOptions = computed(() => {
	const p = project.value;
	const set = new Set(THICKNESSES);
	if (p) set.add(p.thickness);
	return [...set].sort((a, b) => a - b);
});

const productParts = computed(() => (project.value ? project.value.parts.reduce((a, p) => a + (p.qty || 0), 0) : 0));

function applyPreset(e: Event): void {
	const i = Number((e.target as HTMLSelectElement).value);
	const p = PRESETS[i];
	if (project.value && p) {
		project.value.container.w = p.w;
		project.value.container.h = p.h;
	}
	(e.target as HTMLSelectElement).value = '';
}

function addPart(): void {
	project.value?.parts.push({ name: '', w: 40, h: 30, qty: 1 } satisfies Piece);
}

function removePart(i: number): void {
	project.value?.parts.splice(i, 1);
}

async function autoFill(): Promise<void> {
	const p = project.value;
	if (!p || !p.parts.length) return;
	busy.value = true;
	await new Promise((r) => setTimeout(r, 0));
	const cap = capacityOf(p);
	capacity.value = cap;
	if (cap > 0) {
		p.quantity = cap;
		note.value = `Fits ${cap} product${cap === 1 ? '' : 's'} per board.`;
	} else {
		note.value = 'A single product is too big for this board.';
	}
	busy.value = false;
}

async function generate(): Promise<void> {
	const p = project.value;
	if (!p || !p.parts.length) return;
	busy.value = true;
	await new Promise((r) => setTimeout(r, 0));
	const leftover = await store.generate(p.id);
	busy.value = false;
	note.value =
		`Generated ${p.sheets.length} sheet${p.sheets.length === 1 ? '' : 's'} for ${p.quantity} product${p.quantity === 1 ? '' : 's'}.` +
		(leftover ? ` ⚠ ${leftover} part(s) too big for the board.` : '');
}

function sheetOffcut(sh: Sheet): Offcut | null {
	const p = project.value;
	if (!p || !sh.savedLayout) return null;
	return largestEmptyRect(sh.savedLayout, Math.max(1, p.container.w), Math.max(1, p.container.h));
}

function sheetCaption(sh: Sheet): string {
	const p = project.value;
	if (!p) return '';
	const o = sheetOffcut(sh);
	const off = o ? `${Math.round(o.w)}×${Math.round(o.h)}` : '—';
	const used = (sh.savedLayout ?? []).reduce((s, n) => s + n.w * n.h, 0);
	const fill = Math.round((used / Math.max(1, p.container.w * p.container.h)) * 100);
	return `offcut ${off} · ${fill}%`;
}

function openSheet(sh: Sheet): void {
	router.push(`/sheets/${sh.id}`);
}

// reset stale capacity when the product definition changes (but not on quantity tweaks)
watch(
	() => JSON.stringify([project.value?.parts, project.value?.container, project.value?.options]),
	() => {
		capacity.value = null;
	},
);

// autosave the product definition
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
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader :title="project ? project.name : 'Product'">
			<template #action>
				<select
					v-if="store.projects.length"
					:value="store.activeId ?? ''"
					class="max-w-[40vw] rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted"
					@change="store.setActive(($event.target as HTMLSelectElement).value)"
				>
					<option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
				</select>
			</template>
		</AppHeader>

		<div v-if="!project" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
			<p class="text-sm text-muted">No project selected.</p>
			<RouterLink to="/projects" class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
				Pick a project
			</RouterLink>
		</div>

		<div v-else class="flex-1 space-y-5 overflow-y-auto p-3">
			<!-- Board -->
			<section>
				<div class="mb-1 flex items-center justify-between">
					<label class="text-xs font-semibold uppercase tracking-wide text-muted">Board (cm)</label>
					<select class="rounded border border-line bg-surface px-2 py-0.5 text-xs text-muted" @change="applyPreset">
						<option value="">Preset…</option>
						<option v-for="(p, i) in PRESETS" :key="p.label" :value="i">{{ p.label }}</option>
					</select>
				</div>
				<div class="grid grid-cols-3 gap-2">
					<div>
						<span class="text-[11px] text-muted">Width</span>
						<input
							v-model.number="project.container.w"
							type="number"
							step="any"
							min="1"
							class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div>
						<span class="text-[11px] text-muted">Height</span>
						<input
							v-model.number="project.container.h"
							type="number"
							step="any"
							min="1"
							class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div>
						<span class="text-[11px] text-muted">Thickness</span>
						<select
							v-model.number="project.thickness"
							class="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
						>
							<option v-for="t in thicknessOptions" :key="t" :value="t">{{ t }}mm</option>
						</select>
					</div>
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
					<label class="flex items-center gap-1"
						><input v-model="project.options.allowRotate" type="checkbox" /> Allow rotation</label
					>
					<label class="flex items-center gap-1"
						><input v-model="project.options.useKerf" type="checkbox" /> Saw kerf</label
					>
					<input
						v-if="project.options.useKerf"
						v-model.number="project.options.kerf"
						type="number"
						step="any"
						min="0"
						class="w-16 rounded border border-line bg-surface px-1.5 py-1 outline-none focus:border-accent"
					/>
				</div>
			</section>

			<!-- Parts -->
			<section>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
					>Parts (cm) — one product</label
				>
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
						<tr v-for="(pc, i) in project.parts" :key="i" class="border-t border-line">
							<td class="py-1 pr-1">
								<input
									v-model="pc.name"
									type="text"
									placeholder="Top half"
									class="w-full rounded border border-line bg-surface px-2 py-1.5 outline-none focus:border-accent"
								/>
							</td>
							<td class="py-1 pr-1">
								<input
									v-model.number="pc.w"
									type="number"
									step="any"
									min="0.1"
									class="w-16 rounded border border-line bg-surface px-1.5 py-1.5 outline-none focus:border-accent"
								/>
							</td>
							<td class="py-1 pr-1">
								<input
									v-model.number="pc.h"
									type="number"
									step="any"
									min="0.1"
									class="w-16 rounded border border-line bg-surface px-1.5 py-1.5 outline-none focus:border-accent"
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
								<button class="px-1 text-[#ff6b6b]" aria-label="Remove" @click="removePart(i)">×</button>
							</td>
						</tr>
					</tbody>
				</table>
				<button
					class="mt-2 w-full rounded-md border border-line py-2 text-sm text-ink active:border-muted"
					@click="addPart"
				>
					+ Add part
				</button>
			</section>

			<!-- Quantity / generate -->
			<section>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Make</label>
				<div class="flex items-center gap-2">
					<input
						v-model.number="project.quantity"
						type="number"
						min="1"
						class="w-20 rounded-md border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent"
					/>
					<span class="text-sm text-muted">product{{ project.quantity === 1 ? '' : 's' }}</span>
					<button
						class="ml-auto rounded-md border border-line px-3 py-2 text-sm disabled:opacity-40"
						:disabled="!project.parts.length || busy"
						@click="autoFill"
					>
						Auto-fill 1 board
					</button>
				</div>
				<p v-if="capacity !== null" class="mt-1 text-xs text-muted">
					Fits <b class="text-ink">{{ capacity }}</b> product(s) per board.
				</p>
				<button
					class="mt-3 w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-40"
					:disabled="!project.parts.length || busy"
					@click="generate"
				>
					{{ busy ? 'Working…' : 'Generate sheets' }}
				</button>
				<p v-if="note" class="mt-2 text-xs text-[#ffb454]">{{ note }}</p>
			</section>

			<!-- Generated sheets -->
			<section v-if="project.sheets.length">
				<label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
					Sheets ({{ project.sheets.length }}) · {{ productParts }} parts/product
				</label>
				<div class="flex flex-wrap gap-2">
					<VariantCard
						v-for="sh in project.sheets"
						:key="sh.id"
						:name="sh.name"
						:placed="sh.savedLayout ?? []"
						:offcut="sheetOffcut(sh)"
						:container="project.container"
						:caption="sheetCaption(sh)"
						:active="false"
						@click="openSheet(sh)"
					/>
				</div>
			</section>
		</div>
	</div>
</template>
