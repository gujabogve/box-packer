import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { db } from '../db';
import { defaultOptions, type Project, type SavedPlacement } from '../lib/types';
import { planProject } from '../lib/methods';

function uid(): string {
	return crypto.randomUUID();
}

// Strip Vue reactivity to a plain structured-cloneable object before persisting.
function snapshot<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export const useProjectsStore = defineStore('projects', () => {
	const projects = ref<Project[]>([]);
	const activeId = ref<string | null>(null);
	const loaded = ref(false);

	const activeProject = computed(() => projects.value.find((p) => p.id === activeId.value) ?? null);

	async function load(): Promise<void> {
		projects.value = await db.projects.orderBy('updatedAt').reverse().toArray();
		loaded.value = true;
		if (!activeId.value && projects.value.length) activeId.value = projects.value[0].id;
	}

	async function persist(id: string): Promise<void> {
		const p = projects.value.find((x) => x.id === id);
		if (!p) return;
		p.updatedAt = Date.now();
		await db.projects.put(snapshot(p));
	}

	function setActive(id: string): void {
		activeId.value = id;
	}

	async function createProject(name: string): Promise<Project> {
		const p: Project = {
			id: uid(),
			name: name.trim() || 'Untitled',
			createdAt: Date.now(),
			updatedAt: Date.now(),
			parts: [],
			container: { w: 122, h: 244 },
			thickness: 15,
			options: defaultOptions(),
			quantity: 1,
			sheets: [],
		};
		projects.value.unshift(p);
		activeId.value = p.id;
		await db.projects.put(snapshot(p));
		return p;
	}

	async function renameProject(id: string, name: string): Promise<void> {
		const p = projects.value.find((x) => x.id === id);
		if (!p) return;
		p.name = name.trim() || p.name;
		await persist(id);
	}

	async function deleteProject(id: string): Promise<void> {
		projects.value = projects.value.filter((p) => p.id !== id);
		if (activeId.value === id) activeId.value = projects.value[0]?.id ?? null;
		await db.projects.delete(id);
	}

	// Regenerate the whole sheet set for a project (multi-bin pack of quantity × parts).
	// Returns the number of parts too big to fit any board.
	async function generate(projectId: string): Promise<number> {
		const p = projects.value.find((x) => x.id === projectId);
		if (!p) return 0;
		const { sheets, leftover } = planProject(p);
		p.sheets = sheets.map((s, i) => ({
			id: uid(),
			name: `Sheet ${i + 1}`,
			pieces: s.pieces,
			savedLayout: s.placed as SavedPlacement[],
			savedMethod: 'Auto',
		}));
		await persist(projectId);
		return leftover;
	}

	async function deleteSheet(projectId: string, sheetId: string): Promise<void> {
		const p = projects.value.find((x) => x.id === projectId);
		if (!p) return;
		p.sheets = p.sheets.filter((s) => s.id !== sheetId);
		await persist(projectId);
	}

	function getSheet(projectId: string, sheetId: string) {
		const p = projects.value.find((x) => x.id === projectId);
		return p?.sheets.find((s) => s.id === sheetId) ?? null;
	}

	async function exportAll(): Promise<string> {
		return JSON.stringify({ version: 2, projects: snapshot(projects.value) }, null, 2);
	}

	async function importAll(json: string): Promise<void> {
		const data = JSON.parse(json) as { projects?: Project[] };
		const incoming = Array.isArray(data.projects) ? data.projects : [];
		await db.projects.bulkPut(incoming.map((p) => snapshot(p)));
		await load();
	}

	async function clearAll(): Promise<void> {
		await db.projects.clear();
		projects.value = [];
		activeId.value = null;
	}

	return {
		projects,
		activeId,
		activeProject,
		loaded,
		load,
		persist,
		setActive,
		createProject,
		renameProject,
		deleteProject,
		generate,
		deleteSheet,
		getSheet,
		exportAll,
		importAll,
		clearAll,
	};
});
