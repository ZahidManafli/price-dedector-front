const DEFAULT_SITE_NAME = 'Checkila';
const DEFAULT_IMAGE = 'https://checkila.com/checkila-analysis.png';
const JSON_LD_ID = 'checkila-jsonld';

function ensureMetaTag(attributeName, attributeValue, content) {
  if (typeof document === 'undefined') return;

  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let tag = document.head.querySelector(selector);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

function ensureLinkTag(rel, href) {
  if (typeof document === 'undefined') return;

  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }

  tag.setAttribute('href', href);
}

function ensureJsonLd(jsonLd) {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById(JSON_LD_ID);
  if (!jsonLd) {
    if (existing) existing.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = JSON_LD_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd);

  if (!existing) {
    document.head.appendChild(script);
  }
}

export function applySeo({
  title,
  description,
  canonical,
  image = DEFAULT_IMAGE,
  keywords,
  robots = 'index,follow,max-image-preview:large',
  siteName = DEFAULT_SITE_NAME,
  jsonLd,
}) {
  if (typeof document === 'undefined') return;

  if (title) {
    document.title = title;
    ensureMetaTag('property', 'og:title', title);
    ensureMetaTag('name', 'twitter:title', title);
  }

  if (description) {
    ensureMetaTag('name', 'description', description);
    ensureMetaTag('property', 'og:description', description);
    ensureMetaTag('name', 'twitter:description', description);
  }

  if (keywords) {
    ensureMetaTag('name', 'keywords', keywords);
  }

  ensureMetaTag('name', 'robots', robots);
  ensureMetaTag('property', 'og:type', 'website');
  ensureMetaTag('property', 'og:site_name', siteName);
  ensureMetaTag('name', 'twitter:card', 'summary_large_image');

  if (image) {
    ensureMetaTag('property', 'og:image', image);
    ensureMetaTag('property', 'og:image:alt', `${siteName} preview image`);
    ensureMetaTag('name', 'twitter:image', image);
  }

  if (canonical) {
    const canonicalUrl = new URL(canonical, window.location.origin).toString();
    ensureLinkTag('canonical', canonicalUrl);
    ensureMetaTag('property', 'og:url', canonicalUrl);
  }

  ensureJsonLd(jsonLd || null);
}