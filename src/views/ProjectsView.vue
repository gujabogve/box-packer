<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { useProjectsStore } from '../stores/projects';
import type { Project } from '../lib/types';

const store = useProjectsStore();
const router = useRouter();
const newName = ref('');

async function create(): Promise<void> {
	if (!newName.value.trim()) return;
	const p = await store.createProject(newName.value);
	newName.value = '';
	open(p.id);
}

function open(id: string): void {
	store.setActive(id);
	router.push('/sheets');
}

function rename(p: Project): void {
	const name = window.prompt('Project name', p.name);
	if (name != null) void store.renameProject(p.id, name);
}

function remove(p: Project): void {
	if (window.confirm(`Delete "${p.name}" and all its sheets?`)) void store.deleteProject(p.id);
}

function summary(p: Project): string {
	const sheets = p.sheets.length;
	return `${p.parts.length} part${p.parts.length === 1 ? '' : 's'} · ×${p.quantity} · ${sheets} sheet${sheets === 1 ? '' : 's'}`;
}
</script>

<template>
	<div class="flex h-full flex-col">
		<AppHeader title="Projects" />

		<div class="flex gap-2 border-b border-line p-3">
			<input
				v-model="newName"
				type="text"
				placeholder="New project name…"
				class="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
				@keyup.enter="create"
			/>
			<button
				class="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
				:disabled="!newName.trim()"
				@click="create"
			>
				Add
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-3">
			<p v-if="!store.projects.length" class="mt-8 text-center text-sm text-muted">
				No projects yet. Name your first piece of furniture above.
			</p>

			<ul class="flex flex-col gap-2">
				<li
					v-for="p in store.projects"
					:key="p.id"
					class="flex items-center gap-2 rounded-lg border border-line bg-panel p-3 active:border-muted"
				>
					<button class="min-w-0 flex-1 text-left" @click="open(p.id)">
						<div class="truncate font-medium">{{ p.name }}</div>
						<div class="text-xs text-muted">{{ summary(p) }}</div>
					</button>
					<button class="px-2 py-1 text-muted hover:text-ink" aria-label="Rename" @click="rename(p)">✎</button>
					<button class="px-2 py-1 text-[#ff6b6b]" aria-label="Delete" @click="remove(p)">×</button>
				</li>
			</ul>
		</div>
	</div>
</template>
