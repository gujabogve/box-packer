<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue';

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();

function dismiss(): void {
	offlineReady.value = false;
	needRefresh.value = false;
}
</script>

<template>
	<div
		v-if="offlineReady || needRefresh"
		class="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-sm shadow-lg"
	>
		<span class="flex-1">{{ needRefresh ? 'A new version is available.' : 'Ready to work offline.' }}</span>
		<button
			v-if="needRefresh"
			class="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
			@click="updateServiceWorker(true)"
		>
			Reload
		</button>
		<button class="rounded-md border border-line px-3 py-1 text-xs" @click="dismiss">Dismiss</button>
	</div>
</template>
