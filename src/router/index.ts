import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import ProjectsView from '../views/ProjectsView.vue';
import SheetsView from '../views/SheetsView.vue';
import SheetEditorView from '../views/SheetEditorView.vue';
import SettingsView from '../views/SettingsView.vue';

const routes: RouteRecordRaw[] = [
	{ path: '/', redirect: '/projects' },
	{ path: '/projects', name: 'projects', component: ProjectsView },
	{ path: '/sheets', name: 'sheets', component: SheetsView },
	{ path: '/sheets/:sheetId', name: 'editor', component: SheetEditorView, props: true },
	{ path: '/settings', name: 'settings', component: SettingsView },
];

export const router = createRouter({
	history: createWebHashHistory(),
	routes,
});
