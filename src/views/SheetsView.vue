<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { useProjectsStore } from '../stores/projects';
import type { Sheet } from '../lib/types';

const store = useProjectsStore();
const router = useRouter();

const project = computed(() => store.activeProject);

const summary = computed(() => {
	const p = project.value;
	if (!p) return null;
	const pieces = p.sheets.reduce((s, sh) => s + sh.pieces.reduce((a, pc) => a + (pc.qty || 0), 0), 0);
	const byThickness = new Map<number, number>();
	for (const sh of p.sheets) byThickness.set(sh.thickness, (byThickness.get(sh.thickness) ?? 0) + 1);
	const thicknesses = [...byThickness.entries()].sort((a, b) => a[0] - b[0]);
	return { sheets: p.sheets.length, pieces, thicknesses };
});

function sheetPieces(sh: Sheet): number {
	return sh.pieces.reduce((a, pc) => a + (pc.qty || 0), 0);
}

async function addSheet(): Promise<void> {
	if (!project.value) return;
	const sheet = await store.addSheet(project.value.id);
	if (sheet) router.push(`/sheets/${sheet.id}`);
}

function open(sheet: Sheet): void {
	router.push(`/sheets/${sheet.id}`);
}

function remove(sheet: Sheet): void {
	if (!project.value) return;
	if (window.confirm(`Delete sheet "${sheet.name}"?`)) void store.deleteSheet(project.value.id, sheet.id);
}
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader :title="project ? project.name : 'Sheets'">
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

		<template v-else>
			<!-- cut-list summary -->
			<div v-if="summary" class="border-b border-line bg-panel/60 px-3 py-2 text-xs text-muted">
				<span class="text-ink">{{ summary.sheets }}</span> sheet{{ summary.sheets === 1 ? '' : 's' }} ·
				<span class="text-ink">{{ summary.pieces }}</span> piece{{ summary.pieces === 1 ? '' : 's' }}
				<span v-for="[t, n] in summary.thicknesses" :key="t" class="ml-2 rounded bg-surface px-1.5 py-0.5">
					{{ t }}mm ×{{ n }}
				</span>
			</div>

			<div class="flex-1 overflow-y-auto p-3">
				<p v-if="!project.sheets.length" class="mt-8 text-center text-sm text-muted">
					No sheets yet. Add a plywood board to start laying out cuts.
				</p>

				<ul class="flex flex-col gap-2">
					<li
						v-for="sh in project.sheets"
						:key="sh.id"
						class="flex items-center gap-2 rounded-lg border border-line bg-panel p-3 active:border-muted"
					>
						<button class="min-w-0 flex-1 text-left" @click="open(sh)">
							<div class="truncate font-medium">{{ sh.name }}</div>
							<div class="text-xs text-muted">
								{{ sh.container.w }} × {{ sh.container.h }} cm · {{ sh.thickness }}mm thick · {{ sheetPieces(sh) }} pieces
							</div>
						</button>
						<button class="px-2 py-1 text-[#ff6b6b]" aria-label="Delete" @click="remove(sh)">×</button>
					</li>
				</ul>
			</div>

			<div class="border-t border-line p-3">
				<button class="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-white" @click="addSheet">
					+ Add sheet
				</button>
			</div>
		</template>
	</div>
</template>
