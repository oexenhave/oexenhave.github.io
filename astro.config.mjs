// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://oexenhave.dk',
	// Internal links and canonicals still carry the trailing slash WordPress
	// used, but 'ignore' means /lost and /lost/ both resolve. That URL is
	// printed on physical name tags, so it must tolerate being mistyped.
	trailingSlash: 'ignore',
	integrations: [mdx(), sitemap()],
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'IBM Plex Sans',
			cssVariable: '--font-plex-sans',
			weights: [400, 500, 600],
			fallbacks: ['system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'IBM Plex Serif',
			cssVariable: '--font-plex-serif',
			weights: [600],
			fallbacks: ['Georgia', 'serif'],
		},
	],
});
