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

function ensureAlternateLinks(alternates) {
  if (typeof document === 'undefined') return;

  document.head.querySelectorAll('link[rel="alternate"][data-seo-alt="1"]').forEach((tag) => tag.remove());
  if (!alternates || !alternates.length) return;

  alternates.forEach(({ lang, href }) => {
    const tag = document.createElement('link');
    tag.setAttribute('rel', 'alternate');
    tag.setAttribute('hreflang', lang);
    tag.setAttribute('href', new URL(href, window.location.origin).toString());
    tag.setAttribute('data-seo-alt', '1');
    document.head.appendChild(tag);
  });

  const defaultAlt = alternates.find((a) => a.lang === 'en') || alternates[0];
  if (defaultAlt) {
    const tag = document.createElement('link');
    tag.setAttribute('rel', 'alternate');
    tag.setAttribute('hreflang', 'x-default');
    tag.setAttribute('href', new URL(defaultAlt.href, window.location.origin).toString());
    tag.setAttribute('data-seo-alt', '1');
    document.head.appendChild(tag);
  }
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
  htmlLang,
  alternates,
}) {
  if (typeof document === 'undefined') return;

  if (htmlLang) {
    document.documentElement.lang = htmlLang;
  }

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

  ensureAlternateLinks(alternates);
  ensureJsonLd(jsonLd || null);
}