<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Offcut, PackNode } from '../lib/packer';
import { renderLayout } from '../lib/render';

const props = defineProps<{
	name: string;
	placed: PackNode[];
	offcut: Offcut | null;
	container: { w: number; h: number };
	caption: string;
	active: boolean;
}>();

const cv = ref<HTMLCanvasElement | null>(null);

function render(): void {
	if (cv.value)
		renderLayout(
			cv.value,
			props.placed,
			props.offcut,
			Math.max(1, props.container.w),
			Math.max(1, props.container.h),
			150,
			104,
			false,
		);
}

onMounted(render);
watch(() => [props.placed, props.container, props.offcut], render, { deep: true });
</script>

<template>
	<button
		class="flex shrink-0 flex-col items-center gap-1 rounded-lg border bg-[#12151c] p-1.5"
		:class="active ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line'"
	>
		<canvas ref="cv" class="rounded" />
		<span class="text-xs font-medium" :class="active ? 'text-ink' : 'text-muted'">{{ name }}</span>
		<span class="text-[10px] text-muted">{{ caption }}</span>
	</button>
</template>
