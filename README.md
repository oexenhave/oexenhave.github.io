# oexenhave.dk

Personal site. Astro static site, deployed to GitHub Pages.

Migrated from WordPress.com in September 2026. The previous Jekyll site is
preserved on the `archive/jekyll` branch.

## Local development

```
npm install
npm run dev     # http://localhost:4321
npm run build   # output to dist/
npm run preview
```

## URL compatibility

Every URL from the WordPress site is reproduced exactly, so the migration needs
no redirects (GitHub Pages cannot serve them anyway) and loses no inbound links.

- Posts keep their WordPress permalink `/YYYY/MM/DD/slug/`, driven by the
  `permalink` field in each post's frontmatter and routed by
  `src/pages/[...permalink].astro`.
- Static pages live at `/slug/` as Markdown in `src/pages/`.
- `/` and `/blog/` are generated post lists, matching what WordPress rendered.

`migration-urls.json` is the manifest of old URL -> new URL, used to verify the
build covers everything.

## Migration script

`scripts/convert-wp.mjs` re-imports content from the WordPress.com REST API,
downloads every referenced image and PDF into `public/wp/`, and rewrites the
references so the site has no runtime dependency on WordPress. It is idempotent
and overwrites the generated Markdown. It is kept for reference; once the
WordPress plan is cancelled the API will stop responding.

## Deployment

`.github/workflows/deploy.yml` builds and deploys on push to `master`.

Repo setting required once: **Settings -> Pages -> Source: GitHub Actions**.

## Custom domain — not yet attached

`public/CNAME` is deliberately absent. This repo is `oexenhave.github.io`, so
while no CNAME exists the site is testable at <https://oexenhave.github.io>.
Adding a CNAME makes GitHub redirect that URL to the custom domain, which would
break testing before DNS is ready.

At cutover, after DNS points at GitHub Pages:

```
echo "oexenhave.dk" > public/CNAME
```

Then commit, push, and enable **Enforce HTTPS** in Settings -> Pages once the
certificate is issued.
