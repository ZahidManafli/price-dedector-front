// Post-build static prerendering.
//
// Why this exists: this app is a client-rendered SPA (see src/main.jsx —
// ReactDOM.createRoot().render(), no SSR). That means the raw HTML Vite
// builds is just `<div id="root"></div>` — every crawler or SEO tool that
// doesn't execute JavaScript (many don't) sees zero words, no H1, no
// headings and no links, no matter how good the React-rendered content is.
//
// This script launches a real headless browser against the built `dist/`
// output, visits every public marketing route, waits for the app to fully
// render, and writes the resulting DOM as static HTML to
// `dist/<route>/index.html`. Static hosts (Vercel included) serve a
// directory's index.html for a matching path automatically, before falling
// back to the SPA rewrite in vercel.json — so prerendered routes get real,
// crawlable HTML, and every other route (dashboard, auth, etc.) is
// completely unaffected and keeps working exactly as before.
//
// Because src/main.jsx uses `render()` and not `hydrate()`, the client JS
// still fully takes over for real visitors after this static shell paints —
// this only changes what a non-JS crawler / first paint sees, not the
// interactive app.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { SEO_PAGES, SUPPORTED_LANGS, pathFor } from '../src/data/seoPages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Only public, SEO-relevant, content-only routes. Authenticated/dashboard
// routes are intentionally left as pure client-rendered — there's nothing
// for a search crawler to index there, and prerendering them would leak
// nothing useful while adding build time.
const STATIC_ROUTES = ['/', '/about', '/privacy', '/extension-privacy', '/ebay-calculator'];
const SEO_ROUTES = SEO_PAGES.flatMap((page) => SUPPORTED_LANGS.map((lang) => pathFor(page.key, lang)));
const ROUTES = [...STATIC_ROUTES, ...SEO_ROUTES];

function routeToFilePath(route) {
  const clean = route === '/' ? '/index' : `${route}/index`;
  return path.join(DIST_DIR, `${clean}.html`);
}

function startPreviewServer() {
  const server = spawn(`npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return server;
}

function killServer(server) {
  // On Windows, `shell: true` means `server.pid` is cmd.exe, not the actual
  // node/vite process underneath it — a plain child.kill() leaves the real
  // preview server (and its held port) running. Kill the whole tree instead.
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill();
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Server not accepting connections yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server at ${url} did not respond within ${timeoutMs}ms`);
}

async function renderRoute(browser, route) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      // Deterministic default language for routes that don't fix their own
      // (the SEO pages already read `lang` from the URL, not from this).
      window.localStorage.setItem('i18nextLng', 'en');
      window.localStorage.setItem('userLanguage', 'en');
    } catch {
      // localStorage can be unavailable in edge cases; harmless if so.
    }
  });

  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.waitForSelector('h1', { timeout: 8000 });
  } catch (err) {
    console.warn(`  ! ${route} — did not fully settle (${err.message}); capturing current DOM anyway`);
  }

  let html = null;
  try {
    html = await page.content();
  } catch (err) {
    console.warn(`  x ${route} — could not capture DOM (${err.message}); leaving original CSR output in place`);
  }

  await page.close().catch(() => {});
  return html;
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist/ not found — run the Vite build before prerendering.');
    process.exit(1);
  }

  console.log('Starting preview server for prerendering...');
  const server = startPreviewServer();
  let browser;
  let rendered = [];
  try {
    await waitForServer(BASE_URL);

    console.log('Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    console.log(`Rendering ${ROUTES.length} routes...`);
    // Render everything into memory first, then write to disk in one final
    // pass. This guarantees every route is rendered against the pristine
    // original SPA shell — none of them can accidentally pick up another
    // route's already-written static HTML as their fallback mid-crawl.
    for (const route of ROUTES) {
      const html = await renderRoute(browser, route);
      if (html) {
        rendered.push({ route, html });
        console.log(`  ✓ ${route}`);
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    killServer(server);
  }

  for (const { route, html } of rendered) {
    const filePath = routeToFilePath(route);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
  }

  const skipped = ROUTES.length - rendered.length;
  console.log(`Prerendering complete: ${rendered.length} static HTML files written${skipped ? `, ${skipped} route(s) skipped (kept original CSR output)` : ''}.`);
  if (skipped) process.exitCode = 0; // Non-fatal — degrade gracefully rather than failing the deploy.
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
