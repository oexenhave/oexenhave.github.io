// One-shot migration: WordPress.com REST API -> Astro Markdown.
// Re-runnable. Downloads remote images into public/wp/ and rewrites references,
// so the site has no runtime dependency on WordPress once the plan is cancelled.
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import TurndownService from 'turndown';

const SITE = 'oexenhave.dk';
const API = `https://public-api.wordpress.com/wp/v2/sites/${SITE}`;
const ROOT = path.resolve(import.meta.dirname, '..');
const IMG_DIR = path.join(ROOT, 'public', 'wp');

// Pages that the Astro template owns as real routes, not ported content.
// /blog/ and /curriculum-vitae/ are real Astro routes, not ported WordPress
// content; re-importing them would collide with those pages.
const SKIP_PAGES = new Set(['blog', 'curriculum-vitae']);

const td = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
	emDelimiter: '_',
});

// WordPress emits <pre class="wp-block-code"><code>…</code></pre> and legacy
// SyntaxHighlighter <pre class="brush: powershell; …">. Map both to fenced blocks.
td.addRule('wpCodeBlock', {
	filter: (node) => node.nodeName === 'PRE',
	replacement: (_content, node) => {
		const cls = node.getAttribute('class') || '';
		const inner = node.querySelector('code') || node;
		const brush = /brush:\s*([a-z0-9#+-]+)/i.exec(cls);
		let lang = brush ? brush[1].toLowerCase() : '';
		if (lang === 'plain' || lang === 'text') lang = '';
		const code = decode(inner.textContent || '').replace(/\n+$/, '');
		return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
	},
});

// Drop WordPress's separator blocks rather than emitting stray rules.
td.addRule('wpSeparator', {
	filter: (node) => node.nodeName === 'HR',
	replacement: () => '\n\n---\n\n',
});

function decode(s) {
	const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
	return s
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

function yaml(s) {
	return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function getAll(kind) {
	const res = await fetch(`${API}/${kind}?per_page=100&status=publish`);
	if (!res.ok) throw new Error(`${kind}: HTTP ${res.status}`);
	return res.json();
}

const downloaded = new Map();
// WordPress appends resize query strings (?w=1024), so match on the extension
// anywhere in the path and strip the query when naming the local file.
const ASSET_RE =
	/(?:src|href)="(https?:\/\/[^"]+?\.(?:png|jpe?g|gif|webp|svg|pdf))(\?[^"]*)?"/gi;

async function localiseImages(html) {
	const hits = [...html.matchAll(ASSET_RE)].map((m) => ({
		full: m[1] + (m[2] ?? ''),
		clean: m[1],
	}));
	for (const { full, clean: url } of hits) {
		if (!downloaded.has(full)) {
			const name = path.basename(new URL(url).pathname);
			const res = await fetch(full);
			if (!res.ok) {
				console.warn(`  ! asset failed ${res.status}: ${full}`);
				continue;
			}
			await pipeline(Readable.fromWeb(res.body), createWriteStream(path.join(IMG_DIR, name)));
			downloaded.set(full, `/wp/${name}`);
			console.log(`  asset -> public/wp/${name}`);
		}
		html = html.replaceAll(full, downloaded.get(full));
	}
	// The same asset can appear both bare and with a resize query. Once the bare
	// form is rewritten, the query variant no longer matches, so strip leftovers.
	return html.replace(/("\/wp\/[^"?]+)\?[^"]*"/g, '$1"');
}

// Strip WordPress's trailing "share"/subscribe cruft and empty figures.
// WordPress emitted at least one href containing a raw space (the Google Maps
// link on /lost/), which turndown wraps in <> and Markdown then fails to parse.
function encodeHrefSpaces(html) {
	return html.replace(/href="(https?:\/\/[^"]*)"/gi, (m, url) =>
		`href="${url.replace(/ /g, '%20')}"`,
	);
}

function clean(html) {
	return html
		.replace(/<div[^>]*sharedaddy[\s\S]*?<\/div>/gi, '')
		.replace(/<div[^>]*wpcnt[\s\S]*?<\/div>/gi, '');
}

function excerpt(md, fallback) {
	const line = md
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('!['));
	if (!line) return fallback;
	const plain = line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
	return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
}

await mkdir(IMG_DIR, { recursive: true });
await mkdir(path.join(ROOT, 'src', 'content', 'blog'), { recursive: true });

const manifest = [];

const posts = await getAll('posts');
console.log(`posts: ${posts.length}`);
for (const p of posts) {
	const title = decode(p.title.rendered).replace(/\s+/g, ' ').trim();
	const html = await localiseImages(encodeHrefSpaces(clean(p.content.rendered)));
	const body = td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
	const d = new Date(p.date);
	const yyyy = String(d.getFullYear());
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const permalink = `${yyyy}/${mm}/${dd}/${p.slug}`;
	const fm = [
		'---',
		`title: ${yaml(title)}`,
		`description: ${yaml(excerpt(body, title))}`,
		`pubDate: ${yaml(p.date.slice(0, 10))}`,
		`permalink: ${yaml(permalink)}`,
		'---',
		'',
	].join('\n');
	await writeFile(path.join(ROOT, 'src', 'content', 'blog', `${p.slug}.md`), `${fm}${body}\n`);
	manifest.push({ type: 'post', from: p.link, to: `/${permalink}/` });
	console.log(`  ${permalink}`);
}

const pages = await getAll('pages');
console.log(`pages: ${pages.length}`);
for (const g of pages) {
	if (SKIP_PAGES.has(g.slug)) {
		console.log(`  (skipped, template route) ${g.slug}`);
		continue;
	}
	const title = decode(g.title.rendered).replace(/\s+/g, ' ').trim();
	const html = await localiseImages(encodeHrefSpaces(clean(g.content.rendered)));
	const body = td.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
	const fm = [
		'---',
		"layout: ../layouts/Page.astro",
		`title: ${yaml(title)}`,
		`description: ${yaml(excerpt(body, title))}`,
		'---',
		'',
	].join('\n');
	await writeFile(path.join(ROOT, 'src', 'pages', `${g.slug}.md`), `${fm}${body}\n`);
	manifest.push({ type: 'page', from: g.link, to: `/${g.slug}/` });
	console.log(`  /${g.slug}/`);
}

await writeFile(path.join(ROOT, 'migration-urls.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nimages downloaded: ${downloaded.size}`);
console.log(`url manifest: migration-urls.json (${manifest.length} entries)`);
