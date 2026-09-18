// Build-time static prerendering for the public marketing pages.
//
// Why this exists: this app is a pure client-rendered SPA (main.jsx uses
// ReactDOM.createRoot().render(), not hydrateRoot()). That means the raw HTML
// Vercel serves for every route — including the homepage and every SEO
// landing page — is just `<div id="root"></div>` until JavaScript downloads,
// parses and executes. Any crawler or AI answer engine that doesn't execute
// JavaScript (many don't) sees zero page content: no <h1>, no body text, no
// FAQ answers — only the static <head> tags. That's a real, verified problem
// (curl against production showed 0 <h1> tags and an empty <body>), and it
// is very likely why an AI search engine answered incorrectly about a
// feature that's clearly documented on the (JS-rendered) page.
//
// This script runs after `vite build` (see package.json "postbuild"): it
// spins up a local static server over dist/ that behaves exactly like
// vercel.json's SPA rewrite, uses a headless browser to visit every public
// route, waits for React to render, and writes the fully-rendered HTML back
// into dist/<route>/index.html. Because createRoot() (not hydrateRoot())
// is used, there is no hydration-mismatch risk: the client always does a
// clean re-render on top of whatever static HTML shipped, so this is purely
// additive — crawlers and first paint get real content, nothing about the
// live app's behavior changes.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { SEO_PAGES, SUPPORTED_LANGS, pathFor } from '../src/data/seoPages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = 4319;

const STATIC_ROUTES = ['/', '/about', '/privacy', '/extension-privacy', '/ebay-calculator'];
const SEO_ROUTES = SEO_PAGES.flatMap((page) => SUPPORTED_LANGS.map((lang) => pathFor(page.key, lang)));
const ROUTES = [...STATIC_ROUTES, ...SEO_ROUTES];

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

async function fileExists(p) {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

// Mirrors vercel.json's catch-all rewrite: serve the exact static asset if
// one exists at this path, otherwise fall back to the SPA shell.
function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const candidate = path.join(DIST_DIR, urlPath);
        const ext = path.extname(candidate);

        let filePath;
        if (ext && (await fileExists(candidate))) {
          filePath = candidate;
        } else {
          filePath = path.join(DIST_DIR, 'index.html');
        }

        const contentType = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

function routeToOutputPath(route) {
  if (route === '/') return path.join(DIST_DIR, 'index.html');
  const trimmed = route.replace(/\/+$/, '');
  return path.join(DIST_DIR, trimmed, 'index.html');
}

async function prerenderRoute(browser, route) {
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
    // Every public page renders a real <h1> once React mounts and the SEO
    // content resolves; waiting for it is a reliable "page is ready" signal
    // that doesn't depend on knowing each page's internal implementation.
    await page.waitForSelector('h1', { timeout: 15000 });
    // Small settle window for the applySeo() effect (title/meta/JSON-LD) to
    // finish committing after the h1 paints.
    await new Promise((r) => setTimeout(r, 250));
    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
}

async function main() {
  const indexExists = await fileExists(path.join(DIST_DIR, 'index.html'));
  if (!indexExists) {
    // If vite build itself had failed, npm would never have run this
    // postbuild script at all, so reaching this branch means something is
    // genuinely wrong with the build pipeline rather than the environment —
    // worth failing loudly.
    console.error('dist/index.html not found — run `vite build` before prerendering.');
    process.exit(1);
  }

  const server = await startStaticServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  const results = new Map();
  let failures = 0;

  for (const route of ROUTES) {
    try {
      const html = await prerenderRoute(browser, route);
      results.set(route, html);
      console.log(`prerendered ${route}`);
    } catch (err) {
      failures += 1;
      console.warn(`skipped ${route} (falls back to normal client rendering): ${err.message}`);
    }
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  // Write everything only after every page has been captured, so an error
  // partway through never leaves dist/index.html in a half-updated state.
  for (const [route, html] of results) {
    const outPath = routeToOutputPath(route);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
  }

  console.log(`Prerendered ${results.size}/${ROUTES.length} routes (${failures} skipped).`);
}

main().catch((err) => {
  // Prerendering is a progressive enhancement on top of a working CSR app —
  // dist/ already builds and serves correctly without it (that's how the
  // site worked before this script existed). If the environment can't run a
  // headless browser (missing system libs, sandbox restrictions, etc.), we
  // must not fail the whole deployment over an optimization step; log it
  // loudly and let the build finish, falling back to the plain CSR output.
  console.error('Prerender step failed — falling back to unprerendered CSR output. Reason:', err);
  process.exit(0);
});
