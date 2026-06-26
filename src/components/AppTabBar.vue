<script setup lang="ts">
const tabs = [
	{ to: '/projects', label: 'Projects', icon: '▣' },
	{ to: '/sheets', label: 'Product', icon: '▤' },
	{ to: '/settings', label: 'Settings', icon: '⚙' },
];
</script>

<template>
	<nav class="flex shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
		<RouterLink
			v-for="t in tabs"
			:key="t.to"
			:to="t.to"
			class="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted transition-colors"
			active-class="text-accent"
		>
			<span class="text-lg leading-none">{{ t.icon }}</span>
			<span class="text-[11px]">{{ t.label }}</span>
		</RouterLink>
	</nav>
</template>
