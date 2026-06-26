<script setup lang="ts">
import { useRouter } from 'vue-router';

defineProps<{ title: string; back?: boolean }>();

const router = useRouter();
</script>

<template>
	<header class="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-3 py-3">
		<button
			v-if="back"
			class="-ml-1 rounded px-2 py-1 text-lg text-muted hover:text-ink"
			aria-label="Back"
			@click="router.back()"
		>
			←
		</button>
		<h1 class="flex-1 truncate text-base font-semibold">{{ title }}</h1>
		<slot name="action" />
	</header>
</template>
