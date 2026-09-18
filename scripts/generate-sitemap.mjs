// Regenerates public/sitemap.xml from src/data/seoPages.js so the sitemap
// can never drift from the actual routes. Run via `npm run build` (prebuild)
// or manually with `node scripts/generate-sitemap.mjs`.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SEO_PAGES, SUPPORTED_LANGS, DEFAULT_LANG, pathFor, alternatesFor } from '../src/data/seoPages.js';

const SITE_ORIGIN = 'https://checkila.com';
const TODAY = new Date().toISOString().slice(0, 10);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/about', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.4' },
  { loc: '/extension-privacy', changefreq: 'yearly', priority: '0.4' },
  { loc: '/ebay-calculator', changefreq: 'monthly', priority: '0.5' },
];

function xmlEscape(value) {
  return value.replace(/&/g, '&amp;');
}

function urlEntry({ loc, changefreq, priority, pageKey }) {
  const absLoc = `${SITE_ORIGIN}${loc}`;
  const alternates = pageKey ? alternatesFor(pageKey) : null;
  const altLinks = (alternates || [])
    .map(
      ({ lang, href }) =>
        `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${xmlEscape(`${SITE_ORIGIN}${href}`)}" />`
    )
    .join('');
  const xDefault = alternates
    ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(`${SITE_ORIGIN}${pathFor(pageKey, DEFAULT_LANG)}`)}" />`
    : '';

  return `  <url>
    <loc>${xmlEscape(absLoc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${altLinks}${xDefault}
  </url>`;
}

const seoUrlEntries = SEO_PAGES.flatMap((page) =>
  SUPPORTED_LANGS.map((lang) =>
    urlEntry({
      loc: pathFor(page.key, lang),
      changefreq: 'monthly',
      priority: lang === DEFAULT_LANG ? '0.8' : '0.7',
      pageKey: page.key,
    })
  )
);

const staticUrlEntries = STATIC_URLS.map((entry) => urlEntry(entry));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticUrlEntries, ...seoUrlEntries].join('\n')}
</urlset>
`;

writeFileSync(OUTPUT_PATH, xml, 'utf8');
console.log(`Sitemap written to ${OUTPUT_PATH} with ${STATIC_URLS.length + seoUrlEntries.length} URLs.`);
