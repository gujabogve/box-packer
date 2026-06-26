<script setup lang="ts">
import { onMounted } from 'vue';
import AppTabBar from './components/AppTabBar.vue';
import PwaToast from './components/PwaToast.vue';
import { useProjectsStore } from './stores/projects';

const store = useProjectsStore();

onMounted(() => {
	void store.load();
});
</script>

<template>
	<div class="flex h-full flex-col bg-surface text-ink">
		<main class="flex-1 overflow-y-auto">
			<RouterView />
		</main>
		<AppTabBar />
		<PwaToast />
	</div>
</template>
