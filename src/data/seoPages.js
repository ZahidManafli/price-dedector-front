// Single source of truth for the public, SEO-indexable marketing pages.
// Drives route generation (src/routes/seoRoutes.jsx), hreflang alternates,
// and the sitemap generator (scripts/generate-sitemap.mjs).
//
// English is the unprefixed default (e.g. /amazon-price-tracking).
// Other languages are prefixed with a localized slug (e.g. /ru/otslezhivanie-cen-amazon).

export const SUPPORTED_LANGS = ['en', 'tr', 'az', 'ru'];
export const DEFAULT_LANG = 'en';

export const SEO_PAGES = [
  {
    key: 'dropshippingTool',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'ebay-dropshipping-tool',
      tr: 'ebay-dropshipping-araci',
      az: 'ebay-dropshipping-aleti',
      ru: 'instrument-dropshippinga-ebay',
    },
  },
  {
    key: 'productResearch',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'ebay-product-research-tool',
      tr: 'ebay-urun-arastirma-araci',
      az: 'ebay-mehsul-arasdirma-aleti',
      ru: 'instrument-issledovaniya-tovarov-ebay',
    },
  },
  {
    key: 'amazonTracking',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'amazon-price-tracking',
      tr: 'amazon-fiyat-takibi',
      az: 'amazon-qiymet-izlemesi',
      ru: 'otslezhivanie-cen-amazon',
    },
  },
  {
    key: 'profitCalculator',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'ebay-profit-calculator',
      tr: 'ebay-kar-hesaplama-araci',
      az: 'ebay-menfeet-kalkulyatoru',
      ru: 'kalkulyator-pribyli-ebay',
    },
  },
  {
    key: 'marketAnalysis',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'ebay-market-analysis',
      tr: 'ebay-pazar-analizi',
      az: 'ebay-bazar-analizi',
      ru: 'analiz-rynka-ebay',
    },
  },
  {
    key: 'inventoryTracking',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'ebay-inventory-tracking',
      tr: 'ebay-stok-ve-siparis-takibi',
      az: 'ebay-anbar-ve-sifarish-izlemesi',
      ru: 'otslezhivanie-zapasov-i-zakazov-ebay',
    },
  },
  {
    key: 'chromeExtension',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'chrome-extension',
      tr: 'chrome-eklentisi',
      az: 'chrome-elavesi',
      ru: 'rasshirenie-dlya-chrome',
    },
  },
  {
    key: 'telegramBot',
    jsonLdType: 'SoftwareApplication',
    slugs: {
      en: 'telegram-bot',
      tr: 'telegram-botu',
      az: 'telegram-botu',
      ru: 'telegram-bot',
    },
  },
  {
    key: 'ebayFeeCalculator',
    jsonLdType: 'Article',
    // This is the content/reference article. The functional tool lives at
    // the separate, unrelated route /ebay-calculator and is left untouched.
    slugs: {
      en: 'ebay-fee-calculator',
      tr: 'ebay-komisyon-hesaplama',
      az: 'ebay-komissiya-kalkulyatoru',
      ru: 'kalkulyator-komissii-ebay',
    },
  },
];

export function pathFor(pageKey, lang) {
  const page = SEO_PAGES.find((p) => p.key === pageKey);
  if (!page) return '/';
  const slug = page.slugs[lang] || page.slugs[DEFAULT_LANG];
  return lang === DEFAULT_LANG ? `/${slug}` : `/${lang}/${slug}`;
}

export function alternatesFor(pageKey) {
  return SUPPORTED_LANGS.map((lang) => ({ lang, href: pathFor(pageKey, lang) }));
}
