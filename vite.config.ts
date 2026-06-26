import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps asset URLs relative so the app works under the GitHub Pages
// subpath (gujabogve.github.io/box-packer/) without hardcoding the repo name.
export default defineConfig({
	base: './',
	plugins: [
		vue(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				maximumFileSizeToCacheInBytes: 5_000_000,
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,
				navigateFallback: 'index.html',
			},
			manifest: {
				name: 'Box Packer',
				short_name: 'BoxPacker',
				description: 'Plan plywood / sheet-goods cuts and the largest reusable offcut.',
				theme_color: '#0f1115',
				background_color: '#0f1115',
				display: 'standalone',
				orientation: 'any',
				start_url: './',
				scope: './',
				icons: [
					{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
					{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
				],
			},
		}),
	],
});
