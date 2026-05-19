import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dewisoAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────────────────────
   DEFAULT HTML TEMPLATE
───────────────────────────────────────────────────────────────────────────── */
// NOTE: No inline style="background:..." on title/copyright — colors come from CSS vars injected by buildFullHtml
const ONE_COL_BODY = `
<div id="title-part" class="py-3">
<div class="container"><div class="row"><div class="col-12">
<h1 class="primary-text-color">Insert item title here (click on text)</h1>
</div></div></div></div>
<div id="description-container" class="secondary-color-bg pb-3 pt-4">
<div class="container"><div class="row">
<div id="image-gallery" class="col-12 mb-4">
<img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" title="Product Image" />
</div>
<div id="description-part" class="col-12 secondary-color-text">
<p>Carefully describe your item. Focus on benefits, not features! Hold your readers attention by limiting all paragraphs to three sentences or less. Your description doesn't need a thousand words.</p>
<br/>
<p><strong>Features and further details</strong></p>
<ul>
<li><strong>Additional Features:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Details:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Package Includes:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
</ul>
</div></div></div></div>
<div id="copyright-part" class="py-3">
<div class="container primary-text-color" style="font-size:90%;">
<div>Free ebay template editor by <b>checkila.com</b></div>
</div></div>`;

const TWO_COL_BODY = `
<div id="title-part" class="py-3">
<div class="container"><div class="row"><div class="col-12">
<h1 class="primary-text-color">Insert item title here (click on text)</h1>
</div></div></div></div>
<div id="description-container" class="secondary-color-bg pb-3 pt-4">
<div class="container"><div class="row">
<div id="image-gallery" class="col-12 col-md-6 mb-4">
<img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" title="Product Image" />
</div>
<div id="description-part" class="col-12 col-md-6 secondary-color-text">
<p>Carefully describe your item. Focus on benefits, not features! Hold your readers attention by limiting all paragraphs to three sentences or less.</p>
<br/>
<p><strong>Features and further details</strong></p>
<ul>
<li><strong>Additional Features:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Details:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
<li><strong>Package Includes:</strong> Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</li>
</ul>
</div></div></div></div>
<div id="copyright-part" class="py-3">
<div class="container primary-text-color" style="font-size:90%;">
<div>Free ebay template editor by <b>checkila.com</b></div>
</div></div>`;

const AWESOME_DEFAULT_HTML = ONE_COL_BODY; // kept for backward compat

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function extractEditableHtml(html) {
  const source = String(html || '').trim();
  if (!source) return '';
  if (/<html[\s>]/i.test(source)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    return doc.body?.innerHTML?.trim() || '';
  }
  return source;
}

function buildFullHtml(bodyHtml, { navBg, navText, contentBg, contentText }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css">
<style>
  :root {
    --nav-bg: ${navBg};
    --nav-text: ${navText};
    --content-bg: ${contentBg};
    --content-text: ${contentText};
  }
  body { margin: 0 !important; padding: 0 !important; font-size: 18px; background: var(--content-bg); color: var(--content-text); }
  img { max-width: 100%; }
  /* Use !important to override any inline style="background:..." left in user-edited HTML */
  #title-part    { background: var(--nav-bg) !important; color: var(--nav-text) !important; }
  #copyright-part{ background: var(--nav-bg) !important; color: var(--nav-text) !important; }
  .primary-text-color   { color: var(--nav-text) !important; }
  .secondary-color-text { color: var(--content-text) !important; }
  .secondary-color-bg   { background-color: var(--content-bg) !important; }
  .container { max-width: 800px !important; margin-left: auto !important; margin-right: auto !important; }
</style>
</head><body>${bodyHtml}</body></html>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   CHECKILA TEMPLATES  — psychologically engineered to convert browsers → buyers
───────────────────────────────────────────────────────────────────────────── */
const CHECKILA_TEMPLATES = [
  {
    id: 'luxe',
    name: 'Template 1 — Luxe Pro',
    navBg: '#0a0a0a',
    navText: '#c9a84c',
    contentBg: '#fafaf8',
    contentText: '#1a1a1a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#0a0a0a 60%,#1c1408 100%);padding:36px 0 28px;">
    <div class="container">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="background:#c9a84c;color:#0a0a0a;font-size:11px;font-weight:700;letter-spacing:2px;padding:4px 12px;border-radius:2px;text-transform:uppercase;">✦ Premium Quality</span>
        <span style="background:transparent;color:#c9a84c;font-size:11px;font-weight:600;letter-spacing:1px;border:1px solid #c9a84c44;padding:4px 12px;border-radius:2px;">Free Shipping</span>
      </div>
      <h1 style="color:#c9a84c;font-family:Georgia,serif;font-size:2.4rem;font-weight:700;margin:0 0 10px;line-height:1.2;letter-spacing:-0.5px;">Your Premium Product Title Here</h1>
      <p style="color:#e8e0cc;font-size:1.05rem;margin:0;opacity:0.85;">Crafted for those who expect nothing but the best.</p>
      <div style="display:flex;gap:24px;margin-top:18px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;color:#c9a84c;font-size:13px;">⭐⭐⭐⭐⭐ <span style="color:#e8e0cc;opacity:0.7;font-size:12px;">4.9 (2,847 reviews)</span></div>
        <div style="color:#6adf82;font-size:13px;font-weight:600;">✓ In Stock — Ships Today</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:28px;margin:24px 0 20px;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <span style="background:#fff8e7;color:#8b6914;border:1px solid #c9a84c55;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">🏆 Best Seller</span>
        <span style="background:#f0fff4;color:#166534;border:1px solid #86efac;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">✓ Authenticity Guaranteed</span>
        <span style="background:#fef2f2;color:#991b1b;border:1px solid #fca5a5;font-size:12px;font-weight:700;padding:5px 14px;border-radius:3px;">⏰ Only 7 Left!</span>
      </div>
      <div class="row">
        <div id="image-gallery" class="col-12 col-md-6 mb-4">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" style="border-radius:4px;border:1px solid #e8e0cc;" />
        </div>
        <div id="description-part" class="col-12 col-md-6" style="color:#1a1a1a;">
          <h2 style="font-family:Georgia,serif;font-size:1.3rem;color:#0a0a0a;margin-bottom:12px;">Why Buyers Love This</h2>
          <p style="font-size:0.95rem;line-height:1.7;color:#444;margin-bottom:16px;">Every detail has been perfected over years of refinement. This isn't just a product — it's an investment in quality that pays dividends every single day you own it.</p>
          <div style="border-left:3px solid #c9a84c;padding-left:16px;margin:16px 0;font-style:italic;color:#666;font-size:0.9rem;">"Exceeded every expectation. The quality is immediately obvious. Worth every penny." — Verified Buyer</div>
          <ul style="list-style:none;padding:0;margin:0;font-size:0.9rem;">
            <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Superior Materials:</strong> Only the finest, most durable materials used.</span></li>
            <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Expert Craftsmanship:</strong> Hand-inspected before every shipment.</span></li>
            <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>100% Satisfaction Guarantee:</strong> Love it or we make it right.</span></li>
            <li style="padding:7px 0;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Fast, Secure Shipping:</strong> Tracked delivery straight to your door.</span></li>
          </ul>
          <div style="background:linear-gradient(135deg,#0a0a0a,#2a1f05);color:#c9a84c;border-radius:4px;padding:16px;margin-top:20px;text-align:center;">
            <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:4px;">Limited Time Offer</div>
            <div style="font-size:1.6rem;font-weight:700;font-family:Georgia,serif;">Save 30% Today</div>
            <div style="font-size:0.8rem;opacity:0.7;margin-top:4px;">Offer expires when stock runs out</div>
          </div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;">
        <div style="font-size:1.8rem;margin-bottom:6px;">🚚</div>
        <div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Free Shipping</div>
        <div style="font-size:0.78rem;color:#888;margin-top:3px;">On all orders</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;">
        <div style="font-size:1.8rem;margin-bottom:6px;">🔒</div>
        <div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Secure Payment</div>
        <div style="font-size:0.78rem;color:#888;margin-top:3px;">100% protected</div>
      </div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;">
        <div style="font-size:1.8rem;margin-bottom:6px;">↩️</div>
        <div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Easy Returns</div>
        <div style="font-size:0.78rem;color:#888;margin-top:3px;">30-day guarantee</div>
      </div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'bold',
    name: 'Template 2 — Bold Seller',
    navBg: '#0f3460',
    navText: '#ffffff',
    contentBg: '#f0f4ff',
    contentText: '#0d1b2a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(120deg,#0f3460 0%,#16213e 50%,#1a1a2e 100%);padding:32px 0 24px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#e94560 0%,transparent 70%);opacity:0.3;pointer-events:none;"></div>
    <div class="container" style="position:relative;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#e94560;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;padding:5px 14px;border-radius:30px;text-transform:uppercase;margin-bottom:14px;">🔥 HOT DEAL — Ends Soon</div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.3rem;font-weight:800;margin:0 0 10px;line-height:1.15;text-shadow:0 2px 20px rgba(0,0,0,0.3);">Your Product Title — Make It Count</h1>
      <p style="color:#b8c8e8;font-size:1rem;margin:0 0 16px;max-width:560px;">Join <strong style="color:#fff;">47,000+ happy customers</strong> who made the smart choice.</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 18px;backdrop-filter:blur(10px);">
          <div style="color:#ffd700;font-size:18px;letter-spacing:2px;">★★★★★</div>
          <div style="color:#b8c8e8;font-size:11px;margin-top:2px;">4.8 · 3,291 ratings</div>
        </div>
        <div style="color:#4ade80;font-weight:700;font-size:14px;">✓ Ships within 24 hours</div>
        <div style="color:#fbbf24;font-weight:700;font-size:14px;">⚡ 23 sold in last hour</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#e94560;color:#fff;padding:10px 20px;text-align:center;font-weight:700;font-size:0.88rem;letter-spacing:0.5px;border-radius:0 0 8px 8px;margin-bottom:20px;">
      ⏰ Special price valid for <strong>today only</strong> — Don't miss out!
    </div>
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 30px rgba(15,52,96,0.12);margin-bottom:20px;">
      <div class="row" style="margin:0;">
        <div id="image-gallery" class="col-12 col-md-6" style="padding:0;">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" style="width:100%;height:100%;object-fit:cover;display:block;min-height:240px;" />
        </div>
        <div id="description-part" class="col-12 col-md-6" style="padding:28px;color:#0d1b2a;">
          <div style="background:linear-gradient(135deg,#fff8e1,#fffde7);border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
            <div style="font-size:0.78rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏷️ Limited Time Price</div>
            <div style="font-size:1.8rem;font-weight:800;color:#0f3460;">Great Value Today</div>
            <div style="font-size:0.8rem;color:#666;margin-top:2px;">Regular buyers pay 40% more</div>
          </div>
          <p style="font-size:0.93rem;line-height:1.75;color:#334155;margin-bottom:16px;">This is exactly what you've been searching for. Don't settle for less when the best is right here — at a price that makes saying yes easy.</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
            <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">1</span><span><strong>Premium Quality Guaranteed</strong> — you'll feel the difference immediately.</span></div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">2</span><span><strong>Fast Tracked Delivery</strong> — know exactly where your order is.</span></div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">3</span><span><strong>Risk-Free Purchase</strong> — not satisfied? We fix it, no questions.</span></div>
          </div>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;font-size:0.82rem;color:#0c4a6e;line-height:1.5;">
            💬 <em>"I was skeptical at first but this completely blew me away. Faster than expected, better than described!"</em><br/><strong>— Sarah M., Verified Buyer ⭐⭐⭐⭐⭐</strong>
          </div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;box-shadow:0 2px 8px rgba(15,52,96,0.08);">
        <div style="font-size:1.6rem;">📦</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Fast Dispatch</div><div style="font-size:0.75rem;color:#64748b;">Same / next day</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;box-shadow:0 2px 8px rgba(15,52,96,0.08);">
        <div style="font-size:1.6rem;">🛡️</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Buyer Protection</div><div style="font-size:0.75rem;color:#64748b;">eBay guaranteed</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;box-shadow:0 2px 8px rgba(15,52,96,0.08);">
        <div style="font-size:1.6rem;">💯</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Positive Feedback</div><div style="font-size:0.75rem;color:#64748b;">Thousands of buyers</div>
      </div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;box-shadow:0 2px 8px rgba(15,52,96,0.08);">
        <div style="font-size:1.6rem;">🎁</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Gift Ready</div><div style="font-size:0.75rem;color:#64748b;">Careful packaging</div>
      </div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'fresh',
    name: 'Template 3 — Fresh & Clean',
    navBg: '#065f46',
    navText: '#ecfdf5',
    contentBg: '#f8fafc',
    contentText: '#0f172a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#065f46 0%,#047857 50%,#059669 100%);padding:30px 0 24px;">
    <div class="container">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">🌿 Eco-Friendly</span>
        <span style="background:rgba(255,255,255,0.15);color:#ecfdf5;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);">✓ Top Rated Seller</span>
        <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">⚡ Fast Dispatch</span>
      </div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.2rem;font-weight:700;margin:0 0 10px;line-height:1.2;text-shadow:0 1px 10px rgba(0,0,0,0.2);">Your Product Name — Clean &amp; Clear</h1>
      <p style="color:#a7f3d0;font-size:0.98rem;margin:0 0 14px;">Straightforward quality, honest value. Exactly what you need.</p>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <span style="color:#fde68a;font-size:16px;letter-spacing:1px;">★★★★★</span>
        <span style="color:#d1fae5;font-size:12px;">4.9 stars · 1,840 reviews</span>
        <span style="color:#6ee7b7;font-weight:700;font-size:13px;">📦 Free P&amp;P Included</span>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:linear-gradient(90deg,#065f46,#059669);color:#fff;padding:10px 20px;text-align:center;font-size:0.85rem;font-weight:600;margin-bottom:20px;border-radius:0 0 10px 10px;">
      🏷️ Best price on eBay — plus free postage!
    </div>
    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 24px rgba(6,95,70,0.1);margin-bottom:20px;">
      <div class="row" style="margin:0;">
        <div id="image-gallery" class="col-12 col-md-5" style="padding:24px 20px 24px 24px;">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image" style="border-radius:10px;border:1px solid #e2e8f0;width:100%;" />
          <div style="display:flex;gap:6px;margin-top:12px;justify-content:center;flex-wrap:wrap;">
            <span style="background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;">✓ 100% Authentic</span>
            <span style="background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;">✓ Brand New</span>
          </div>
        </div>
        <div id="description-part" class="col-12 col-md-7" style="padding:28px 24px 24px 8px;color:#0f172a;">
          <h2 style="font-size:1.2rem;font-weight:700;color:#065f46;margin-bottom:12px;font-family:'Trebuchet MS',sans-serif;">What Makes This Special</h2>
          <p style="font-size:0.92rem;line-height:1.75;color:#475569;margin-bottom:16px;">No fluff, no gimmicks. Just a product that does what it promises and arrives exactly as described. We believe in straightforward quality and honest dealings with every customer.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
            <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Premium Quality</strong> — carefully inspected and packed to perfection.</div></div>
            <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Quick Delivery</strong> — dispatched promptly with full tracking.</div></div>
            <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Hassle-Free Returns</strong> — we stand behind everything we sell.</div></div>
            <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Trusted Seller</strong> — thousands of 5-star transactions.</div></div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #059669;border-radius:8px;padding:14px 16px;font-size:0.82rem;color:#064e3b;line-height:1.6;">
            💬 <em>"Arrived quickly, well packaged and exactly as described. Already recommended to friends!"</em><br/><strong style="color:#065f46;">— James T. ⭐⭐⭐⭐⭐ Verified Purchase</strong>
          </div>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;">
      <h3 style="font-size:0.95rem;font-weight:700;color:#065f46;margin:0 0 14px;text-align:center;">Why Shop With Us?</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;">
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🌱</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Ethically Sourced</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">📬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Free Postage</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">💬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Fast Responses</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🔁</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Easy Returns</div></div>
      </div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   TWO-IMAGE TEMPLATES  — psychologically engineered, 2 product images
   Psychology notes:
   • Deep navy + warm amber = trust (blue) + desire (warm gold) — premium conversion combo
   • Crimson urgency band triggers scarcity reflex; dual-image proof reduces buyer hesitation
   • Forest green + cream = safety, organic trust; side-by-side images signal transparency
───────────────────────────────────────────────────────────────────────────── */
const TWO_IMAGE_TEMPLATES = [
  {
    id: 'luxe-2img',
    name: 'Luxe Pro — 2 Images',
    navBg: '#0a0a0a',
    navText: '#c9a84c',
    contentBg: '#fafaf8',
    contentText: '#1a1a1a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#0a0a0a 60%,#1c1408 100%);padding:36px 0 28px;">
    <div class="container">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="background:#c9a84c;color:#0a0a0a;font-size:11px;font-weight:700;letter-spacing:2px;padding:4px 12px;border-radius:2px;text-transform:uppercase;">✦ Premium Quality</span>
        <span style="background:transparent;color:#c9a84c;font-size:11px;font-weight:600;letter-spacing:1px;border:1px solid #c9a84c44;padding:4px 12px;border-radius:2px;">Free Shipping</span>
      </div>
      <h1 style="color:#c9a84c;font-family:Georgia,serif;font-size:2.4rem;font-weight:700;margin:0 0 10px;line-height:1.2;letter-spacing:-0.5px;">Your Premium Product Title Here</h1>
      <p style="color:#e8e0cc;font-size:1.05rem;margin:0;opacity:0.85;">Crafted for those who expect nothing but the best.</p>
      <div style="display:flex;gap:24px;margin-top:18px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;color:#c9a84c;font-size:13px;">⭐⭐⭐⭐⭐ <span style="color:#e8e0cc;opacity:0.7;font-size:12px;">4.9 (2,847 reviews)</span></div>
        <div style="color:#6adf82;font-size:13px;font-weight:600;">✓ In Stock — Ships Today</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:28px;margin:24px 0 20px;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <span style="background:#fff8e7;color:#8b6914;border:1px solid #c9a84c55;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">🏆 Best Seller</span>
        <span style="background:#f0fff4;color:#166534;border:1px solid #86efac;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">✓ Authenticity Guaranteed</span>
        <span style="background:#fef2f2;color:#991b1b;border:1px solid #fca5a5;font-size:12px;font-weight:700;padding:5px 14px;border-radius:3px;">⏰ Only 7 Left!</span>
      </div>
      <!-- TWO IMAGES side by side -->
      <div id="image-gallery" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="position:relative;">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="border-radius:4px;border:1px solid #e8e0cc;width:100%;display:block;" />
          <div style="position:absolute;bottom:8px;left:8px;background:rgba(10,10,10,0.75);color:#c9a84c;font-size:10px;font-weight:700;padding:3px 8px;border-radius:2px;letter-spacing:1px;">FRONT VIEW</div>
        </div>
        <div style="position:relative;">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="border-radius:4px;border:1px solid #e8e0cc;width:100%;display:block;" />
          <div style="position:absolute;bottom:8px;left:8px;background:rgba(10,10,10,0.75);color:#c9a84c;font-size:10px;font-weight:700;padding:3px 8px;border-radius:2px;letter-spacing:1px;">DETAIL VIEW</div>
        </div>
      </div>
      <div id="description-part" style="color:#1a1a1a;">
        <h2 style="font-family:Georgia,serif;font-size:1.3rem;color:#0a0a0a;margin-bottom:12px;">Why Buyers Love This</h2>
        <p style="font-size:0.95rem;line-height:1.7;color:#444;margin-bottom:16px;">Every detail has been perfected over years of refinement. This isn't just a product — it's an investment in quality that pays dividends every single day you own it.</p>
        <div style="border-left:3px solid #c9a84c;padding-left:16px;margin:16px 0;font-style:italic;color:#666;font-size:0.9rem;">"Exceeded every expectation. The quality is immediately obvious. Worth every penny." — Verified Buyer</div>
        <ul style="list-style:none;padding:0;margin:0;font-size:0.9rem;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Superior Materials</strong></span></li>
          <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Expert Craftsmanship</strong></span></li>
          <li style="padding:7px 0;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>100% Satisfaction</strong></span></li>
          <li style="padding:7px 0;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Fast, Secure Shipping</strong></span></li>
        </ul>
        <div style="background:linear-gradient(135deg,#0a0a0a,#2a1f05);color:#c9a84c;border-radius:4px;padding:16px;margin-top:20px;text-align:center;">
          <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:4px;">Limited Time Offer</div>
          <div style="font-size:1.6rem;font-weight:700;font-family:Georgia,serif;">Save 30% Today</div>
          <div style="font-size:0.8rem;opacity:0.7;margin-top:4px;">Offer expires when stock runs out</div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">🚚</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Free Shipping</div></div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">🔒</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Secure Payment</div></div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">↩️</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Easy Returns</div></div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'bold-2img',
    name: 'Bold Seller — 2 Images',
    navBg: '#0f3460',
    navText: '#ffffff',
    contentBg: '#f0f4ff',
    contentText: '#0d1b2a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(120deg,#0f3460 0%,#16213e 50%,#1a1a2e 100%);padding:32px 0 24px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#e94560 0%,transparent 70%);opacity:0.3;pointer-events:none;"></div>
    <div class="container" style="position:relative;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#e94560;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;padding:5px 14px;border-radius:30px;text-transform:uppercase;margin-bottom:14px;">🔥 HOT DEAL — Ends Soon</div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.3rem;font-weight:800;margin:0 0 10px;line-height:1.15;text-shadow:0 2px 20px rgba(0,0,0,0.3);">Your Product Title — Make It Count</h1>
      <p style="color:#b8c8e8;font-size:1rem;margin:0 0 16px;max-width:560px;">Join <strong style="color:#fff;">47,000+ happy customers</strong> who made the smart choice.</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 18px;">
          <div style="color:#ffd700;font-size:18px;letter-spacing:2px;">★★★★★</div>
          <div style="color:#b8c8e8;font-size:11px;margin-top:2px;">4.8 · 3,291 ratings</div>
        </div>
        <div style="color:#4ade80;font-weight:700;font-size:14px;">✓ Ships within 24 hours</div>
        <div style="color:#fbbf24;font-weight:700;font-size:14px;">⚡ 23 sold in last hour</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#e94560;color:#fff;padding:10px 20px;text-align:center;font-weight:700;font-size:0.88rem;letter-spacing:0.5px;border-radius:0 0 8px 8px;margin-bottom:20px;">
      ⏰ Special price valid for <strong>today only</strong> — Don't miss out!
    </div>
    <!-- TWO IMAGES side by side -->
    <div id="image-gallery" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
      <div style="border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,52,96,0.15);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="width:100%;display:block;object-fit:cover;min-height:200px;" />
        <div style="background:#0f3460;color:#fff;text-align:center;font-size:11px;font-weight:700;padding:6px;letter-spacing:1px;">MAIN VIEW</div>
      </div>
      <div style="border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,52,96,0.15);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="width:100%;display:block;object-fit:cover;min-height:200px;" />
        <div style="background:#e94560;color:#fff;text-align:center;font-size:11px;font-weight:700;padding:6px;letter-spacing:1px;">CLOSE-UP</div>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 30px rgba(15,52,96,0.12);margin-bottom:20px;">
      <div id="description-part" style="padding:28px;color:#0d1b2a;">
        <div style="background:linear-gradient(135deg,#fff8e1,#fffde7);border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:inline-block;width:100%;">
          <div style="font-size:0.78rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏷️ Limited Time Price</div>
          <div style="font-size:1.8rem;font-weight:800;color:#0f3460;">Great Value Today</div>
          <div style="font-size:0.8rem;color:#666;margin-top:2px;">Regular buyers pay 40% more</div>
        </div>
        <p style="font-size:0.93rem;line-height:1.75;color:#334155;margin-bottom:16px;">This is exactly what you've been searching for. Don't settle for less when the best is right here — at a price that makes saying yes easy.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">1</span><span><strong>Premium Quality</strong></span></div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">2</span><span><strong>Fast Tracked Delivery</strong></span></div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">3</span><span><strong>Risk-Free Purchase</strong></span></div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#e94560;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">4</span><span><strong>Buyer Protection</strong></span></div>
        </div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;font-size:0.82rem;color:#0c4a6e;line-height:1.5;">
          💬 <em>"I was skeptical at first but this completely blew me away. Faster than expected, better than described!"</em><br/><strong>— Sarah M., Verified Buyer ⭐⭐⭐⭐⭐</strong>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">📦</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Fast Dispatch</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">🛡️</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Buyer Protection</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">💯</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Positive Feedback</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">🎁</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Gift Ready</div></div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'fresh-2img',
    name: 'Fresh & Clean — 2 Images',
    navBg: '#065f46',
    navText: '#ecfdf5',
    contentBg: '#f8fafc',
    contentText: '#0f172a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#065f46 0%,#047857 50%,#059669 100%);padding:30px 0 24px;">
    <div class="container">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">🌿 Eco-Friendly</span>
        <span style="background:rgba(255,255,255,0.15);color:#ecfdf5;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);">✓ Top Rated Seller</span>
        <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">⚡ Fast Dispatch</span>
      </div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.2rem;font-weight:700;margin:0 0 10px;line-height:1.2;">Your Product Name — Clean &amp; Clear</h1>
      <p style="color:#a7f3d0;font-size:0.98rem;margin:0 0 14px;">Straightforward quality, honest value. Exactly what you need.</p>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <span style="color:#fde68a;font-size:16px;letter-spacing:1px;">★★★★★</span>
        <span style="color:#d1fae5;font-size:12px;">4.9 stars · 1,840 reviews</span>
        <span style="color:#6ee7b7;font-weight:700;font-size:13px;">📦 Free P&amp;P Included</span>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:linear-gradient(90deg,#065f46,#059669);color:#fff;padding:10px 20px;text-align:center;font-size:0.85rem;font-weight:600;margin-bottom:20px;border-radius:0 0 10px 10px;">
      🏷️ Best price on eBay — plus free postage!
    </div>
    <!-- TWO IMAGES side by side -->
    <div id="image-gallery" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(6,95,70,0.1);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="width:100%;display:block;" />
        <div style="padding:8px 12px;background:#f0fdf4;display:flex;gap:6px;justify-content:center;">
          <span style="background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0;font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;">✓ 100% Authentic</span>
        </div>
      </div>
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(6,95,70,0.1);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="width:100%;display:block;" />
        <div style="padding:8px 12px;background:#f0fdf4;display:flex;gap:6px;justify-content:center;">
          <span style="background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0;font-size:10px;font-weight:600;padding:3px 8px;border-radius:6px;">✓ Brand New</span>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:14px;box-shadow:0 2px 24px rgba(6,95,70,0.1);margin-bottom:20px;padding:28px 24px;">
      <div id="description-part" style="color:#0f172a;">
        <h2 style="font-size:1.2rem;font-weight:700;color:#065f46;margin-bottom:12px;font-family:'Trebuchet MS',sans-serif;">What Makes This Special</h2>
        <p style="font-size:0.92rem;line-height:1.75;color:#475569;margin-bottom:16px;">No fluff, no gimmicks. Just a product that does what it promises and arrives exactly as described. We believe in straightforward quality and honest dealings with every customer.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Premium Quality</strong></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Quick Delivery</strong></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Hassle-Free Returns</strong></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Trusted Seller</strong></div></div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #059669;border-radius:8px;padding:14px 16px;font-size:0.82rem;color:#064e3b;line-height:1.6;">
          💬 <em>"Arrived quickly, well packaged and exactly as described. Already recommended to friends!"</em><br/><strong style="color:#065f46;">— James T. ⭐⭐⭐⭐⭐ Verified Purchase</strong>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;">
      <h3 style="font-size:0.95rem;font-weight:700;color:#065f46;margin:0 0 14px;text-align:center;">Why Shop With Us?</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;">
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🌱</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Ethically Sourced</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">📬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Free Postage</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">💬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Fast Responses</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🔁</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Easy Returns</div></div>
      </div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   THREE-IMAGE TEMPLATES  — psychologically engineered, 3 product images
   Psychology notes:
   • 3 images = "rule of three" — the brain finds trios easiest to process & remember
   • Black/gold: authority + aspiration triggers aspirational buying ("I deserve the best")
   • Deep blue/crimson: combines safety (blue) with urgency (red) — maximum conversion combo
   • Teal/cream: wellness palette — calming yet aspirational; ideal for lifestyle & health items
───────────────────────────────────────────────────────────────────────────── */
const THREE_IMAGE_TEMPLATES = [
  {
    id: 'luxe-3img',
    name: 'Luxe Pro — 3 Images',
    navBg: '#0a0a0a',
    navText: '#c9a84c',
    contentBg: '#fafaf8',
    contentText: '#1a1a1a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#0a0a0a 60%,#1c1408 100%);padding:36px 0 28px;">
    <div class="container">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="background:#c9a84c;color:#0a0a0a;font-size:11px;font-weight:700;letter-spacing:2px;padding:4px 12px;border-radius:2px;text-transform:uppercase;">✦ Premium Quality</span>
        <span style="background:transparent;color:#c9a84c;font-size:11px;font-weight:600;letter-spacing:1px;border:1px solid #c9a84c44;padding:4px 12px;border-radius:2px;">Free Shipping</span>
        <span style="background:#c9a84c22;color:#c9a84c;font-size:11px;font-weight:600;padding:4px 12px;border-radius:2px;border:1px solid #c9a84c33;">⏰ Only 7 Left</span>
      </div>
      <h1 style="color:#c9a84c;font-family:Georgia,serif;font-size:2.4rem;font-weight:700;margin:0 0 10px;line-height:1.2;letter-spacing:-0.5px;">Your Premium Product Title Here</h1>
      <p style="color:#e8e0cc;font-size:1.05rem;margin:0;opacity:0.85;">Crafted for those who expect nothing but the best.</p>
      <div style="display:flex;gap:24px;margin-top:18px;flex-wrap:wrap;">
        <div style="color:#c9a84c;font-size:13px;">⭐⭐⭐⭐⭐ <span style="color:#e8e0cc;opacity:0.7;font-size:12px;">4.9 (2,847 reviews)</span></div>
        <div style="color:#6adf82;font-size:13px;font-weight:600;">✓ In Stock — Ships Today</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:28px;margin:24px 0 20px;box-shadow:0 2px 20px rgba(0,0,0,0.06);">
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <span style="background:#fff8e7;color:#8b6914;border:1px solid #c9a84c55;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">🏆 Best Seller</span>
        <span style="background:#f0fff4;color:#166534;border:1px solid #86efac;font-size:12px;font-weight:600;padding:5px 14px;border-radius:3px;">✓ Authenticity Guaranteed</span>
        <span style="background:#fef2f2;color:#991b1b;border:1px solid #fca5a5;font-size:12px;font-weight:700;padding:5px 14px;border-radius:3px;">🔥 Limited Stock</span>
      </div>
      <!-- THREE IMAGES: 1 large + 2 smaller -->
      <div id="image-gallery" style="margin-bottom:24px;">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="border-radius:4px;border:1px solid #e8e0cc;width:100%;display:block;margin-bottom:12px;" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="position:relative;">
            <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="border-radius:4px;border:1px solid #e8e0cc;width:100%;display:block;" />
            <div style="position:absolute;bottom:6px;left:6px;background:rgba(10,10,10,0.8);color:#c9a84c;font-size:9px;font-weight:700;padding:2px 7px;border-radius:2px;letter-spacing:1px;">SIDE VIEW</div>
          </div>
          <div style="position:relative;">
            <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 3" style="border-radius:4px;border:1px solid #e8e0cc;width:100%;display:block;" />
            <div style="position:absolute;bottom:6px;left:6px;background:rgba(10,10,10,0.8);color:#c9a84c;font-size:9px;font-weight:700;padding:2px 7px;border-radius:2px;letter-spacing:1px;">DETAIL</div>
          </div>
        </div>
      </div>
      <div id="description-part" style="color:#1a1a1a;">
        <h2 style="font-family:Georgia,serif;font-size:1.3rem;color:#0a0a0a;margin-bottom:12px;">Why Buyers Love This</h2>
        <p style="font-size:0.95rem;line-height:1.7;color:#444;margin-bottom:16px;">Every detail has been perfected over years of refinement. This isn't just a product — it's an investment in quality that pays dividends every single day you own it.</p>
        <div style="border-left:3px solid #c9a84c;padding-left:16px;margin:16px 0;font-style:italic;color:#666;font-size:0.9rem;">"Exceeded every expectation. The quality is immediately obvious. Worth every penny." — Verified Buyer</div>
        <ul style="list-style:none;padding:0;margin:0;font-size:0.9rem;">
          <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Superior Materials:</strong> Only the finest, most durable materials used.</span></li>
          <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Expert Craftsmanship:</strong> Hand-inspected before every shipment.</span></li>
          <li style="padding:7px 0;border-bottom:1px solid #f0ede8;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>100% Satisfaction Guarantee:</strong> Love it or we make it right.</span></li>
          <li style="padding:7px 0;display:flex;gap:8px;align-items:flex-start;"><span style="color:#c9a84c;font-weight:700;flex-shrink:0;">✦</span><span><strong>Fast, Secure Shipping:</strong> Tracked delivery straight to your door.</span></li>
        </ul>
        <div style="background:linear-gradient(135deg,#0a0a0a,#2a1f05);color:#c9a84c;border-radius:4px;padding:16px;margin-top:20px;text-align:center;">
          <div style="font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:4px;">Limited Time Offer</div>
          <div style="font-size:1.6rem;font-weight:700;font-family:Georgia,serif;">Save 30% Today</div>
          <div style="font-size:0.8rem;opacity:0.7;margin-top:4px;">Offer expires when stock runs out</div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">🚚</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Free Shipping</div></div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">🔒</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Secure Payment</div></div>
      <div style="background:#fff;border:1px solid #e8e0cc;border-radius:4px;padding:18px;text-align:center;"><div style="font-size:1.8rem;margin-bottom:6px;">↩️</div><div style="font-weight:700;font-size:0.85rem;color:#0a0a0a;">Easy Returns</div></div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'bold-3img',
    name: 'Bold Seller — 3 Images',
    navBg: '#0f3460',
    navText: '#ffffff',
    contentBg: '#f0f4ff',
    contentText: '#0d1b2a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(120deg,#0f3460 0%,#16213e 50%,#1a1a2e 100%);padding:32px 0 24px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#e94560 0%,transparent 70%);opacity:0.3;pointer-events:none;"></div>
    <div class="container" style="position:relative;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:#e94560;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;padding:5px 14px;border-radius:30px;text-transform:uppercase;margin-bottom:14px;">🔥 HOT DEAL — Ends Soon</div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.3rem;font-weight:800;margin:0 0 10px;line-height:1.15;text-shadow:0 2px 20px rgba(0,0,0,0.3);">Your Product Title — Make It Count</h1>
      <p style="color:#b8c8e8;font-size:1rem;margin:0 0 16px;max-width:560px;">Join <strong style="color:#fff;">47,000+ happy customers</strong> who made the smart choice.</p>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px 18px;">
          <div style="color:#ffd700;font-size:18px;letter-spacing:2px;">★★★★★</div>
          <div style="color:#b8c8e8;font-size:11px;margin-top:2px;">4.8 · 3,291 ratings</div>
        </div>
        <div style="color:#4ade80;font-weight:700;font-size:14px;">✓ Ships within 24 hours</div>
        <div style="color:#fbbf24;font-weight:700;font-size:14px;">⚡ 23 sold in last hour</div>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:#e94560;color:#fff;padding:10px 20px;text-align:center;font-weight:700;font-size:0.88rem;letter-spacing:0.5px;border-radius:0 0 8px 8px;margin-bottom:20px;">
      ⏰ Special price valid for <strong>today only</strong> — Don't miss out!
    </div>
    <!-- THREE IMAGES: row of 3 equal columns -->
    <div id="image-gallery" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(15,52,96,0.15);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="width:100%;display:block;object-fit:cover;min-height:160px;" />
        <div style="background:#0f3460;color:#fff;text-align:center;font-size:10px;font-weight:700;padding:5px;letter-spacing:1px;">FRONT</div>
      </div>
      <div style="border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(233,69,96,0.2);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="width:100%;display:block;object-fit:cover;min-height:160px;" />
        <div style="background:#e94560;color:#fff;text-align:center;font-size:10px;font-weight:700;padding:5px;letter-spacing:1px;">IN USE</div>
      </div>
      <div style="border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(15,52,96,0.15);">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 3" style="width:100%;display:block;object-fit:cover;min-height:160px;" />
        <div style="background:#0f3460;color:#fff;text-align:center;font-size:10px;font-weight:700;padding:5px;letter-spacing:1px;">DETAIL</div>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 30px rgba(15,52,96,0.12);margin-bottom:20px;padding:28px;">
      <div id="description-part" style="color:#0d1b2a;">
        <div style="background:linear-gradient(135deg,#fff8e1,#fffde7);border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
          <div style="font-size:0.78rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏷️ Limited Time Price</div>
          <div style="font-size:1.8rem;font-weight:800;color:#0f3460;">Great Value Today</div>
          <div style="font-size:0.8rem;color:#666;margin-top:2px;">Regular buyers pay 40% more</div>
        </div>
        <p style="font-size:0.93rem;line-height:1.75;color:#334155;margin-bottom:16px;">This is exactly what you've been searching for. Don't settle for less when the best is right here — at a price that makes saying yes easy.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">1</span><span><strong>Premium Quality Guaranteed</strong> — you'll feel the difference immediately.</span></div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">2</span><span><strong>Fast Tracked Delivery</strong> — know exactly where your order is.</span></div>
          <div style="display:flex;align-items:center;gap:10px;font-size:0.88rem;"><span style="background:#0f3460;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">3</span><span><strong>Risk-Free Purchase</strong> — not satisfied? We fix it, no questions.</span></div>
        </div>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px 16px;font-size:0.82rem;color:#0c4a6e;line-height:1.5;">
          💬 <em>"I was skeptical at first but this completely blew me away. Faster than expected, better than described!"</em><br/><strong>— Sarah M., Verified Buyer ⭐⭐⭐⭐⭐</strong>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">📦</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Fast Dispatch</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">🛡️</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Buyer Protection</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">💯</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Positive Feedback</div></div>
      <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;border:1px solid #dbeafe;"><div style="font-size:1.6rem;">🎁</div><div style="font-weight:700;font-size:0.83rem;color:#0f3460;margin-top:5px;">Gift Ready</div></div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
  {
    id: 'fresh-3img',
    name: 'Fresh & Clean — 3 Images',
    navBg: '#065f46',
    navText: '#ecfdf5',
    contentBg: '#f8fafc',
    contentText: '#0f172a',
    body: `
<div id="title-part" class="py-0">
  <div style="background:linear-gradient(135deg,#065f46 0%,#047857 50%,#059669 100%);padding:30px 0 24px;">
    <div class="container">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:#ecfdf5;color:#065f46;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">🌿 Eco-Friendly</span>
        <span style="background:rgba(255,255,255,0.15);color:#ecfdf5;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);">✓ Top Rated Seller</span>
        <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;">⚡ Fast Dispatch</span>
      </div>
      <h1 style="color:#ffffff;font-family:'Trebuchet MS',sans-serif;font-size:2.2rem;font-weight:700;margin:0 0 10px;line-height:1.2;">Your Product Name — Clean &amp; Clear</h1>
      <p style="color:#a7f3d0;font-size:0.98rem;margin:0 0 14px;">Straightforward quality, honest value. Exactly what you need.</p>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <span style="color:#fde68a;font-size:16px;letter-spacing:1px;">★★★★★</span>
        <span style="color:#d1fae5;font-size:12px;">4.9 stars · 1,840 reviews</span>
        <span style="color:#6ee7b7;font-weight:700;font-size:13px;">📦 Free P&amp;P Included</span>
      </div>
    </div>
  </div>
</div>
<div id="description-container" class="secondary-color-bg pb-3 pt-0">
  <div class="container">
    <div style="background:linear-gradient(90deg,#065f46,#059669);color:#fff;padding:10px 20px;text-align:center;font-size:0.85rem;font-weight:600;margin-bottom:20px;border-radius:0 0 10px 10px;">
      🏷️ Best price on eBay — plus free postage!
    </div>
    <!-- THREE IMAGES: 1 wide hero + 2 thumbnails below -->
    <div id="image-gallery" style="margin-bottom:20px;">
      <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(6,95,70,0.12);margin-bottom:12px;">
        <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 1" style="width:100%;display:block;" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(6,95,70,0.1);">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 2" style="width:100%;display:block;" />
          <div style="padding:6px 10px;background:#f0fdf4;font-size:10px;font-weight:700;color:#065f46;text-align:center;letter-spacing:0.5px;">SIDE ANGLE</div>
        </div>
        <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(6,95,70,0.1);">
          <img class="img-fluid" src="https://i.postimg.cc/7Z6XLxbS/default-image-1.png" alt="Product Image 3" style="width:100%;display:block;" />
          <div style="padding:6px 10px;background:#f0fdf4;font-size:10px;font-weight:700;color:#065f46;text-align:center;letter-spacing:0.5px;">CLOSE-UP</div>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:14px;box-shadow:0 2px 24px rgba(6,95,70,0.1);margin-bottom:20px;padding:28px 24px;">
      <div id="description-part" style="color:#0f172a;">
        <h2 style="font-size:1.2rem;font-weight:700;color:#065f46;margin-bottom:12px;font-family:'Trebuchet MS',sans-serif;">What Makes This Special</h2>
        <p style="font-size:0.92rem;line-height:1.75;color:#475569;margin-bottom:16px;">No fluff, no gimmicks. Just a product that does what it promises and arrives exactly as described. We believe in straightforward quality and honest dealings with every customer.</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Premium Quality</strong> — carefully inspected and packed to perfection.</div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Quick Delivery</strong> — dispatched promptly with full tracking.</div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Hassle-Free Returns</strong> — we stand behind everything we sell.</div></div>
          <div style="display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;"><span style="color:#059669;font-size:16px;flex-shrink:0;line-height:1;">✓</span><div><strong>Trusted Seller</strong> — thousands of 5-star transactions.</div></div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #059669;border-radius:8px;padding:14px 16px;font-size:0.82rem;color:#064e3b;line-height:1.6;">
          💬 <em>"Arrived quickly, well packaged and exactly as described. Already recommended to friends!"</em><br/><strong style="color:#065f46;">— James T. ⭐⭐⭐⭐⭐ Verified Purchase</strong>
        </div>
      </div>
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;">
      <h3 style="font-size:0.95rem;font-weight:700;color:#065f46;margin:0 0 14px;text-align:center;">Why Shop With Us?</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;">
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🌱</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Ethically Sourced</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">📬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Free Postage</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">💬</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Fast Responses</div></div>
        <div style="text-align:center;padding:12px 8px;"><div style="font-size:1.5rem;">🔁</div><div style="font-weight:700;font-size:0.82rem;color:#0f172a;margin-top:6px;">Easy Returns</div></div>
      </div>
    </div>
  </div>
</div>
<div id="copyright-part" class="py-3">
  <div class="container primary-text-color" style="font-size:90%;text-align:center;">
    <div>Free ebay template editor by <b>checkila.com</b></div>
  </div>
</div>`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   FLOATING TOOLBAR COMPONENT
   This is the key fix — toolbar stays above the preview iframe/div and uses
   document.execCommand on the iframe's document so focus never leaves.
───────────────────────────────────────────────────────────────────────────── */
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
const FONT_FAMILIES = [
  'system-ui, -apple-system, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Arial, sans-serif',
  'Trebuchet MS, sans-serif',
  'Impact, sans-serif',
];

function FloatingToolbar({ iframeRef }) {
  const { t } = useTranslation('common');
  const [activeFormats, setActiveFormats] = useState({});
  const [fontSize, setFontSize] = useState('18px');
  const [fontFamily, setFontFamily] = useState('system-ui, -apple-system, sans-serif');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffff00');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef(null);

  // Get the iframe's document
  const getIframeDoc = useCallback(() => {
    return iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
  }, [iframeRef]);

  // Save selection before toolbar interaction
  const saveSelection = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, [getIframeDoc]);

  // Restore selection after toolbar interaction
  const restoreSelection = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc || !savedSelectionRef.current) return;
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionRef.current);
  }, [getIframeDoc]);

  // Execute formatting command in iframe
  const execCmd = useCallback((cmd, value = null) => {
    const doc = getIframeDoc();
    if (!doc) return;
    restoreSelection();
    doc.execCommand(cmd, false, value);
    // Keep focus in iframe
    iframeRef.current?.contentWindow?.focus();
    updateActiveFormats();
  }, [getIframeDoc, restoreSelection, iframeRef]);

  const updateActiveFormats = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    setActiveFormats({
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
      strikeThrough: doc.queryCommandState('strikeThrough'),
      justifyLeft: doc.queryCommandState('justifyLeft'),
      justifyCenter: doc.queryCommandState('justifyCenter'),
      justifyRight: doc.queryCommandState('justifyRight'),
      insertOrderedList: doc.queryCommandState('insertOrderedList'),
      insertUnorderedList: doc.queryCommandState('insertUnorderedList'),
    });
  }, [getIframeDoc]);

  // Listen for selection changes inside iframe
  useEffect(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    const handler = () => { saveSelection(); updateActiveFormats(); };
    doc.addEventListener('selectionchange', handler);
    return () => doc.removeEventListener('selectionchange', handler);
  }, [getIframeDoc, saveSelection, updateActiveFormats]);

  // Separate ref to capture the selection right when the user opens the dropdown
  const pendingRangeRef = useRef(null);

  const captureRangeForSelect = useCallback(() => {
    const doc = getIframeDoc();
    if (!doc) return;
    const sel = doc.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      pendingRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else if (savedSelectionRef.current && !savedSelectionRef.current.collapsed) {
      pendingRangeRef.current = savedSelectionRef.current.cloneRange();
    } else {
      pendingRangeRef.current = null;
    }
  }, [getIframeDoc]);

  const applySpanStyle = useCallback((styleProp, styleValue) => {
    const doc = getIframeDoc();
    if (!doc) return;

    // Use the range captured on mousedown (before dropdown stole focus)
    const range = pendingRangeRef.current;
    if (!range || range.collapsed) return;

    // Restore selection so DOM ops work on the right spot
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    try {
      const frag = range.extractContents();
      const span = doc.createElement('span');
      span.style[styleProp] = styleValue;
      span.appendChild(frag);
      range.insertNode(span);
      // Re-select the newly inserted span contents
      const newRange = doc.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedSelectionRef.current = newRange.cloneRange();
    } catch (err) {
      console.warn('applySpanStyle failed', err);
    }

    pendingRangeRef.current = null;
    iframeRef.current?.contentWindow?.focus();
  }, [getIframeDoc, iframeRef]);

  const handleFontSize = (e) => {
    const size = e.target.value;
    setFontSize(size);
    applySpanStyle('fontSize', size);
  };

  const handleFontFamily = (e) => {
    const family = e.target.value;
    setFontFamily(family);
    applySpanStyle('fontFamily', family);
  };

  const handleTextColor = (e) => {
    const color = e.target.value;
    setTextColor(color);
    applySpanStyle('color', color);
  };

  const handleBgColor = (e) => {
    const color = e.target.value;
    setBgColor(color);
    applySpanStyle('backgroundColor', color);
  };

  const handleLink = () => {
    saveSelection();
    setShowLinkInput(true);
    setLinkUrl('');
  };

  const applyLink = () => {
    if (linkUrl.trim()) {
      execCmd('createLink', linkUrl.trim());
    }
    setShowLinkInput(false);
  };

  const handleImage = () => {
    const url = window.prompt(t('dewisoPage.enterImageUrl'));
    if (url?.trim()) {
      execCmd('insertImage', url.trim());
    }
  };

  const handleUndo = () => {
    const doc = getIframeDoc();
    if (!doc) return;
    doc.execCommand('undo', false, null);
    iframeRef.current?.contentWindow?.focus();
  };

  const handleRedo = () => {
    const doc = getIframeDoc();
    if (!doc) return;
    doc.execCommand('redo', false, null);
    iframeRef.current?.contentWindow?.focus();
  };

  const btn = (active) =>
    `px-2 py-1 rounded text-sm font-medium border transition-all select-none cursor-pointer ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
    }`;

  return (
    <div
      className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50 border-slate-200"
      // CRITICAL: prevent mousedown from stealing focus from the iframe
      onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
    >
      {/* Undo / Redo */}
      <button className={btn(false)} onClick={handleUndo} title={t('dewisoPage.undo')}>↩</button>
      <button className={btn(false)} onClick={handleRedo} title={t('dewisoPage.redo')}>↪</button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Font family */}
      <select
        className="text-xs border border-slate-200 rounded px-1 py-1 bg-white text-slate-700 cursor-pointer"
        value={fontFamily}
        onChange={handleFontFamily}
        onMouseDown={(e) => { e.stopPropagation(); captureRangeForSelect(); }}
        title={t('dewisoPage.fontFamily')}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f} style={{ fontFamily: f }}>
            {f.split(',')[0]}
          </option>
        ))}
      </select>

      {/* Font size */}
      <select
        className="text-xs border border-slate-200 rounded px-1 py-1 bg-white text-slate-700 cursor-pointer w-20"
        value={fontSize}
        onChange={handleFontSize}
        onMouseDown={(e) => { e.stopPropagation(); captureRangeForSelect(); }}
        title={t('dewisoPage.fontSize')}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Text color */}
      <label
        className="flex items-center gap-1 cursor-pointer px-1 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs select-none"
        title={t('dewisoPage.textColor') || 'Text color'}
        onMouseDown={(e) => { e.stopPropagation(); captureRangeForSelect(); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62z"/><rect x="3" y="19" width="18" height="3" rx="1" fill={textColor}/></svg>
        <input
          type="color"
          className="w-0 h-0 opacity-0 absolute"
          value={textColor}
          onChange={handleTextColor}
        />
        <span style={{ width: 14, height: 4, background: textColor, borderRadius: 2, display: 'inline-block', border: '1px solid #ccc' }} />
      </label>

      {/* Background color */}
      <label
        className="flex items-center gap-1 cursor-pointer px-1 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs select-none"
        title={t('dewisoPage.bgColor') || 'Highlight color'}
        onMouseDown={(e) => { e.stopPropagation(); captureRangeForSelect(); }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/><rect x="3" y="19" width="18" height="3" rx="1" fill={bgColor}/></svg>
        <input
          type="color"
          className="w-0 h-0 opacity-0 absolute"
          value={bgColor}
          onChange={handleBgColor}
        />
        <span style={{ width: 14, height: 4, background: bgColor, borderRadius: 2, display: 'inline-block', border: '1px solid #ccc' }} />
      </label>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Bold / Italic / Underline / Strike */}
      <button className={btn(activeFormats.bold)} onClick={() => execCmd('bold')} title={t('dewisoPage.bold')}><b>B</b></button>
      <button className={btn(activeFormats.italic)} onClick={() => execCmd('italic')} title={t('dewisoPage.italic')}><i>I</i></button>
      <button className={btn(activeFormats.underline)} onClick={() => execCmd('underline')} title={t('dewisoPage.underline')}><u>U</u></button>
      <button className={btn(activeFormats.strikeThrough)} onClick={() => execCmd('strikeThrough')} title={t('dewisoPage.strikethrough')}><s>S</s></button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Alignment */}
      <button className={btn(activeFormats.justifyLeft)} onClick={() => execCmd('justifyLeft')} title={t('dewisoPage.alignLeft')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.justifyCenter)} onClick={() => execCmd('justifyCenter')} title={t('dewisoPage.alignCenter')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm3 4h12v2H6V9zm-3 4h18v2H3v-2zm3 4h12v2H6v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.justifyRight)} onClick={() => execCmd('justifyRight')} title={t('dewisoPage.alignRight')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5zm6 4h12v2H9V9zm-6 4h18v2H3v-2zm6 4h12v2H9v-2z"/></svg>
      </button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Lists */}
      <button className={btn(activeFormats.insertUnorderedList)} onClick={() => execCmd('insertUnorderedList')} title={t('dewisoPage.bulletList')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7V5zm-3 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7v-2zm-3 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-1h14v2H7v-2z"/></svg>
      </button>
      <button className={btn(activeFormats.insertOrderedList)} onClick={() => execCmd('insertOrderedList')} title={t('dewisoPage.numberedList')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 4h1v3H3V4zm4 1h14v2H7V5zM3 9h2v1H4v1h1v1H3V9zm4 2h14v2H7v-2zm-4 4h2v1H4l2 3H3l-1-1.5L4 15H3v-1zm4 1h14v2H7v-2z"/></svg>
      </button>

      <div className="w-px h-5 bg-slate-300 mx-1" />

      {/* Link */}
      <button className={btn(false)} onClick={handleLink} title={t('dewisoPage.insertLink')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
      </button>

      {/* Image */}
      <button className={btn(false)} onClick={handleImage} title={t('dewisoPage.insertImage')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
      </button>

      {/* Remove formatting */}
      <button className={btn(false)} onClick={() => execCmd('removeFormat')} title={t('dewisoPage.removeFormatting')}>
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6zm-2.81-1L1.27 1.27 0 2.54 4.73 7.27 3.55 10h2.41l1.27 3h2.41l-1-2.41L13.45 15l-1.24 3H15l.72-1.71L18.46 20l1.27-1.27L3.19 4z"/></svg>
      </button>

      {/* Inline link input */}
      {showLinkInput && (
        <div className="flex items-center gap-1 ml-1">
          <input
            autoFocus
            className="text-xs border border-slate-300 rounded px-2 py-1 w-48"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
          />
          <button className="text-xs px-2 py-1 bg-indigo-600 text-white rounded" onClick={applyLink}>{t('dewisoPage.ok')}</button>
          <button className="text-xs px-2 py-1 bg-slate-200 rounded" onClick={() => setShowLinkInput(false)}>{t('dewisoPage.close')}</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function DewisoPage() {
  const { isDark } = useTheme();
  const { t } = useTranslation('common');

  // Layout & colours
  const [layout, setLayout] = useState('one_col');
  const [navBg, setNavBg] = useState('#2A0948');
  const [navText, setNavText] = useState('#ffffff');
  const [contentBg, setContentBg] = useState('#F5F5F5');
  const [contentText, setContentText] = useState('#000000');

  // Template meta
  const [templateName, setTemplateName] = useState('My Dewiso Template');
  const [bodyHtml, setBodyHtml] = useState(() => ONE_COL_BODY);

  // History
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template gallery tab: '1img' | '2img' | '3img'
  const [templateTab, setTemplateTab] = useState('1img');

  // Images
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);

  // Alert
  const [alert, setAlert] = useState(null);

  // Iframe ref (the live editable preview lives inside an iframe so it has
  // its own document — this is the key to keeping focus stable)
  const iframeRef = useRef(null);

  // Tracks whether iframe content is initialised
  const iframeReadyRef = useRef(false);

  // Suppress re-inject while user is actively editing
  const isEditingRef = useRef(false);

  /* ── Load history ── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingHistory(true);
        const res = await dewisoAPI.getHistory(30);
        setHistory(res?.data?.items || []);
      } catch (err) {
        setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.failedToLoadHistory') });
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, []);

  /* ── Full HTML for download/copy ── */
  const fullHtml = useMemo(
    () => buildFullHtml(bodyHtml, { navBg, navText, contentBg, contentText }),
    [bodyHtml, navBg, navText, contentBg, contentText]
  );

  /* ── Write content into iframe ──
     We write the full themed page into the iframe but also set it
     contenteditable so the user can edit directly inside. */
  const writeIframe = useCallback((html) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    // Make body editable
    doc.body.contentEditable = 'true';
    doc.body.style.outline = 'none';
    doc.designMode = 'on'; // enables execCommand on the whole doc
    iframeReadyRef.current = true;

    // Listen for changes inside iframe
    const onInput = () => {
      isEditingRef.current = true;
      setBodyHtml(doc.body.innerHTML);
    };
    const onBlur = () => { isEditingRef.current = false; };
    const onFocus = () => { isEditingRef.current = true; };

    doc.body.addEventListener('input', onInput);
    doc.body.addEventListener('blur', onBlur, true);
    doc.body.addEventListener('focus', onFocus, true);

    // Image click → replace src
    doc.body.addEventListener('click', (e) => {
      const img = e.target?.closest?.('img');
      if (!img) return;
      const choice = window.confirm(t('dewisoPage.chooseImageAction'));
      if (!choice) return;
      const url = window.prompt(t('dewisoPage.imageUrl'));
      if (url?.trim()) {
        img.src = url.trim();
        setBodyHtml(doc.body.innerHTML);
      }
    });
  }, []);

  /* ── Initial iframe load ── */
  useEffect(() => {
    // Small delay to ensure iframe is mounted
    const t = setTimeout(() => {
      writeIframe(fullHtml);
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Live-update CSS vars in iframe when colors change ──
     Instead of full writeIframe (which destroys edits), we just patch
     the :root CSS variables directly in the iframe's document. ── */
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // Find or create our theme <style> tag
    let styleEl = doc.getElementById('__dewiso_theme__');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = '__dewiso_theme__';
      doc.head?.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --nav-bg: ${navBg} !important;
        --nav-text: ${navText} !important;
        --content-bg: ${contentBg} !important;
        --content-text: ${contentText} !important;
      }
      #title-part     { background: ${navBg} !important; color: ${navText} !important; }
      #copyright-part { background: ${navBg} !important; color: ${navText} !important; }
      .primary-text-color   { color: ${navText} !important; }
      .secondary-color-text { color: ${contentText} !important; }
      .secondary-color-bg   { background-color: ${contentBg} !important; }
      body { background: ${contentBg} !important; color: ${contentText} !important; }
    `;
  }, [navBg, navText, contentBg, contentText]);

  /* ── Handlers ── */
  const handleUploadHtmlFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const extracted = extractEditableHtml(text);
    setBodyHtml(extracted);
    writeIframe(buildFullHtml(extracted, { navBg, navText, contentBg, contentText }));
    setAlert({ type: 'success', message: t('dewisoPage.loadedFile', { fileName: file.name }) });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      setUploadingImages(true);
      const formData = new FormData();
      files.forEach((f) => formData.append('images', f));
      if (selectedHistoryId) formData.append('templateId', selectedHistoryId);
      const res = await dewisoAPI.uploadImages(formData);
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setUploadedImages((prev) => {
        const merged = [...prev, ...items];
        const seen = new Set();
        return merged.filter((img) => {
          const key = `${img?.localUrl}|${img?.ebayUrl}|${img?.fileName}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setAlert({ type: 'success', message: t('dewisoPage.uploadedImagesCount', { count: items.length }) });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.uploadFailed') });
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      const payload = {
        id: selectedHistoryId || undefined,
        name: templateName || 'Untitled',
        mode: layout,
        html: fullHtml,
        meta: { navBg, navText, contentBg, contentText, images: uploadedImages },
      };
      const res = await dewisoAPI.saveHistory(payload);
      const nextId = res?.data?.id || selectedHistoryId;
      const list = await dewisoAPI.getHistory(30);
      setHistory(list?.data?.items || []);
      setSelectedHistoryId(nextId || null);
      setAlert({ type: 'success', message: t('dewisoPage.templateSaved') });
    } catch (err) {
      setAlert({ type: 'error', message: err.response?.data?.error || t('dewisoPage.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const loadFromHistory = (item) => {
    setSelectedHistoryId(item.id);
    setTemplateName(item.name || 'Untitled');
    setLayout(item.mode || 'one_col');
    const extracted = extractEditableHtml(item.html || '');
    setBodyHtml(extracted);
    if (item.meta) {
      setNavBg(item.meta.navBg || '#2A0948');
      setNavText(item.meta.navText || '#ffffff');
      setContentBg(item.meta.contentBg || '#F5F5F5');
      setContentText(item.meta.contentText || '#000000');
      setUploadedImages(Array.isArray(item.meta.images) ? item.meta.images : []);
    }
    writeIframe(buildFullHtml(extracted, {
      navBg: item.meta?.navBg || navBg,
      navText: item.meta?.navText || navText,
      contentBg: item.meta?.contentBg || contentBg,
      contentText: item.meta?.contentText || contentText,
    }));
  };

  const loadCheckilaTemplate = (tpl) => {
    setSelectedHistoryId(null);
    setTemplateName(tpl.name);
    setLayout('two_col');
    setNavBg(tpl.navBg);
    setNavText(tpl.navText);
    setContentBg(tpl.contentBg);
    setContentText(tpl.contentText);
    setBodyHtml(tpl.body);
    writeIframe(buildFullHtml(tpl.body, {
      navBg: tpl.navBg, navText: tpl.navText,
      contentBg: tpl.contentBg, contentText: tpl.contentText,
    }));
  };

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value || '').trim());
      setAlert({ type: 'success', message: t('dewisoPage.copied') });
    } catch {
      setAlert({ type: 'warning', message: t('dewisoPage.copyFailed') });
    }
  };

  const downloadHtml = () => {
    const filename = `${templateName || 'dewiso'}.html`;
    const link = document.createElement('a');
    link.href = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`;
    link.download = filename;
    link.click();
  };

  /* ── UI ── */
  return (
    <div className="page-shell">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`page-title ${isDark ? 'text-slate-100' : ''}`}>{t('dewisoPage.title')}</h1>
        <button className="btn-primary" onClick={saveTemplate} disabled={saving}>
          {saving ? t('dewisoPage.saving') : t('dewisoPage.saveToHistory')}
        </button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
        {/* ── LEFT PANEL ── */}
        <div className={`xl:col-span-4 rounded-2xl border p-4 space-y-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>

          {/* ── Checkila Templates ── */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              ✦ Checkila Templates
            </p>
            {/* Tab switcher: 1 / 2 / 3 images */}
            <div className={`flex rounded-lg overflow-hidden border mb-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {[
                { key: '1img', label: '1 Image' },
                { key: '2img', label: '2 Images' },
                { key: '3img', label: '3 Images' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTemplateTab(key)}
                  className="flex-1 text-xs font-semibold py-1.5 transition-all"
                  style={{
                    background: templateTab === key
                      ? (isDark ? '#10b981' : '#065f46')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    color: templateTab === key ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                    borderRight: key !== '3img' ? `1px solid ${isDark ? '#334155' : '#e2e8f0'}` : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {(templateTab === '1img' ? CHECKILA_TEMPLATES : templateTab === '2img' ? TWO_IMAGE_TEMPLATES : THREE_IMAGE_TEMPLATES).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => loadCheckilaTemplate(tpl)}
                  className="w-full text-left rounded-xl overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                  style={{ borderColor: tpl.navBg + '55' }}
                >
                  <div style={{ background: `linear-gradient(135deg, ${tpl.navBg}, ${tpl.navBg}cc)` }} className="px-3 py-2 flex items-center justify-between">
                    <span style={{ color: tpl.navText, fontWeight: 700, fontSize: 12, letterSpacing: '0.5px' }}>{tpl.name}</span>
                    <span style={{ background: tpl.navText + '22', color: tpl.navText, fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Load →</span>
                  </div>
                  <div style={{ background: tpl.contentBg, padding: '6px 12px', display: 'flex', gap: 6 }}>
                    {[tpl.navBg, tpl.navText, tpl.contentBg, tpl.contentText].map((c, i) => (
                      <span key={i} style={{ width: 14, height: 14, background: c, borderRadius: '50%', border: '1px solid #0002', display: 'inline-block' }} />
                    ))}
                    <span style={{ fontSize: 10, color: tpl.contentText + 'aa', marginLeft: 4, alignSelf: 'center' }}>
                      {templateTab === '1img' ? '1 image · optimized' : templateTab === '2img' ? '2 images · dual proof' : '3 images · full showcase'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={`border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`} />

          {/* Layout selector */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.selectLayout')}</p>
            <div className="flex gap-2 flex-wrap">
              {['one_col', 'two_col', 'own_html'].map((l) => (
                <button
                  key={l}
                  className={`btn-secondary text-xs ${layout === l ? 'ring-2 ring-indigo-500' : ''}`}
                  onClick={() => {
                    setLayout(l);
                    // Load the correct default body when switching layouts
                    if (l === 'one_col') {
                      setBodyHtml(ONE_COL_BODY);
                      writeIframe(buildFullHtml(ONE_COL_BODY, { navBg, navText, contentBg, contentText }));
                      setAlert({ type: 'success', message: t('dewisoPage.oneColumnTemplateLoaded') });
                    } else if (l === 'two_col') {
                      setBodyHtml(TWO_COL_BODY);
                      writeIframe(buildFullHtml(TWO_COL_BODY, { navBg, navText, contentBg, contentText }));
                      setAlert({ type: 'success', message: t('dewisoPage.twoColumnsTemplateLoaded') });
                    }
                    // 'own_html' keeps whatever is currently in the editor
                  }}
                >
                  {l === 'one_col' ? t('dewisoPage.layoutOneColumn') : l === 'two_col' ? t('dewisoPage.layoutTwoColumns') : t('dewisoPage.layoutOwnHtml')}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('dewisoPage.color')} <strong>{t('dewisoPage.navFooter')}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                {t('dewisoPage.background')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={navBg} onChange={(e) => setNavBg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={navBg} onChange={(e) => setNavBg(e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-slate-500">
                {t('dewisoPage.text')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={navText} onChange={(e) => setNavText(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={navText} onChange={(e) => setNavText(e.target.value)} />
                </div>
              </label>
            </div>
          </div>

          <div>
            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {t('dewisoPage.color')} <strong>{t('dewisoPage.contentArea')}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                {t('dewisoPage.background')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={contentBg} onChange={(e) => setContentBg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={contentBg} onChange={(e) => setContentBg(e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-slate-500">
                {t('dewisoPage.text')}
                <div className="flex gap-2 mt-1">
                  <input type="color" value={contentText} onChange={(e) => setContentText(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />
                  <input className="input-base text-xs flex-1" value={contentText} onChange={(e) => setContentText(e.target.value)} />
                </div>
              </label>
            </div>
          </div>

          {/* Template name + file upload */}
          <div className="space-y-2">
            <input
              className="input-base w-full"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('dewisoPage.templateNamePlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer text-xs">
                {t('dewisoPage.uploadHtml')}
                <input type="file" accept=".html,.htm" className="hidden" onChange={handleUploadHtmlFile} />
              </label>
              <label className={`btn-secondary cursor-pointer text-xs ${uploadingImages ? 'opacity-60' : ''}`}>
                {uploadingImages ? t('dewisoPage.uploading') : t('dewisoPage.uploadImages')}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
              </label>
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  const body = layout === 'two_col' ? TWO_COL_BODY : ONE_COL_BODY;
                  setBodyHtml(body);
                  writeIframe(buildFullHtml(body, { navBg, navText, contentBg, contentText }));
                  setAlert({ type: 'success', message: t('dewisoPage.defaultTemplateLoaded') });
                }}
              >
                {t('dewisoPage.resetToDefault')}
              </button>
            </div>
          </div>

          {/* Uploaded images */}
          {uploadedImages.length > 0 && (
            <div>
              <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.uploadedImages')}</p>
              <div className="space-y-2 max-h-48 overflow-auto">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className={`rounded-lg border p-2 flex gap-2 items-start ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                    <img src={img?.localUrl || ''} alt="" className="h-10 w-10 rounded object-cover border border-slate-200" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{img?.fileName || t('dewisoPage.imageLabel', { index: idx + 1 })}</p>
                      {img?.ebayUrl && (
                        <button className="text-[11px] text-indigo-500 hover:underline" onClick={() => copyText(img.ebayUrl)}>
                          {t('dewisoPage.copyEbayLink')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dewisoPage.history')}</p>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{ background: saving ? '#94a3b8' : '#4f46e5', color: '#fff', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '⏳ Saving…' : '💾 Save Now'}
              </button>
            </div>
            <div className="max-h-52 overflow-auto space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-slate-500">{t('dewisoPage.loading')}</p>
              ) : history.length === 0 ? (
                <div className={`rounded-xl border-2 border-dashed p-4 text-center ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="text-2xl mb-1">📂</div>
                  <p className="text-xs text-slate-500">No saved templates yet.<br/>Hit <strong>Save Now</strong> to keep your work.</p>
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadFromHistory(item)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-all hover:shadow-sm ${
                      selectedHistoryId === item.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate">{item.name}</div>
                      {selectedHistoryId === item.id && <span className="text-indigo-500 text-xs flex-shrink-0">● Active</span>}
                    </div>
                    <div className="text-xs opacity-60 mt-0.5">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Preview with embedded toolbar ── */}
        <div className={`xl:col-span-8 rounded-2xl border overflow-hidden flex flex-col ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          {/* Preview header */}
          <div className={`px-4 py-2 border-b text-sm flex justify-between items-center ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'}`}>
            <span className="font-medium">{t('dewisoPage.livePreviewHint')}</span>
            <div className="flex gap-2">
              <button className="text-xs btn-secondary px-2 py-1" onClick={() => copyText(fullHtml)}>{t('dewisoPage.copyHtml')}</button>
              <button className="text-xs btn-secondary px-2 py-1" onClick={downloadHtml}>{t('dewisoPage.downloadHtml')}</button>
            </div>
          </div>

          {/* ★ Floating toolbar that edits the iframe — no focus loss ★ */}
          <FloatingToolbar iframeRef={iframeRef} />

          {/* Iframe — the preview lives here, fully editable */}
          <iframe
            ref={iframeRef}
            title="Dewiso Preview"
            className="flex-1 w-full border-0"
            style={{ minHeight: '600px' }}
            sandbox="allow-same-origin allow-scripts"
            onLoad={() => {
              // Re-enable designMode on any navigation inside iframe
              const doc = iframeRef.current?.contentDocument;
              if (doc && doc.body) {
                doc.body.contentEditable = 'true';
                doc.designMode = 'on';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
