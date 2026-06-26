<script setup lang="ts">
import { ref } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import { useProjectsStore } from '../stores/projects';

const store = useProjectsStore();
const json = ref('');
const note = ref('');

async function exportData(): Promise<void> {
	json.value = await store.exportAll();
	await navigator.clipboard?.writeText(json.value).catch(() => {});
	note.value = 'Exported & copied to clipboard.';
}

function download(): void {
	const blob = new Blob([json.value || ''], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'box-packer-backup.json';
	a.click();
	URL.revokeObjectURL(url);
}

async function importData(): Promise<void> {
	try {
		await store.importAll(json.value);
		note.value = 'Imported successfully.';
	} catch (e) {
		note.value = 'Invalid JSON: ' + (e as Error).message;
	}
}

async function clearAll(): Promise<void> {
	if (window.confirm('Delete ALL projects? This cannot be undone.')) {
		await store.clearAll();
		note.value = 'All data cleared.';
	}
}
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader title="Settings" />

		<div class="flex-1 overflow-y-auto p-3">
			<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Backup</h2>
			<p class="mb-2 text-xs text-muted">
				All data lives on this device. Export to back up or move to another device.
			</p>
			<div class="mb-2 flex gap-2">
				<button class="flex-1 rounded-md bg-accent py-2 text-sm font-semibold text-white" @click="exportData">
					Export
				</button>
				<button class="flex-1 rounded-md border border-line py-2 text-sm" @click="download">Download .json</button>
			</div>
			<textarea
				v-model="json"
				spellcheck="false"
				placeholder="Paste a backup here, then Import…"
				class="h-40 w-full resize-y rounded-md border border-line bg-surface p-2 font-mono text-xs outline-none focus:border-accent"
			></textarea>
			<button class="mt-2 w-full rounded-md border border-line py-2 text-sm" @click="importData">Import</button>

			<p v-if="note" class="mt-3 text-xs text-[#ffb454]">{{ note }}</p>

			<h2 class="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Danger zone</h2>
			<button class="w-full rounded-md border border-[#ff6b6b] py-2 text-sm text-[#ff6b6b]" @click="clearAll">
				Clear all data
			</button>
		</div>
	</div>
</template>
