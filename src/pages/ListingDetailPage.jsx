import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  ImageOff,
  Loader2,
  Minus,
  Package,
  Plus,
  Settings2,
  ShoppingBag,
  Truck,
  Zap,
} from 'lucide-react';
import { ebayAPI, productAPI } from '../services/api';
import { calculateProfit } from '../utils/helpers';
import { formatLongDate } from '../utils/dateFormat';

const TITLE_MAX = 80; // eBay's title length limit

// ── Value humanizers (eBay Trading API returns raw enums/booleans) ───────────

function isTrue(value) {
  return String(value).toLowerCase() === 'true';
}

// ISO 8601 duration ("P29DT9H35M23S") -> { days, hours }
function parseIsoDuration(value) {
  const m = String(value || '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/);
  if (!m) return null;
  return { days: Number(m[1] || 0), hours: Number(m[2] || 0), minutes: Number(m[3] || 0) };
}

function money(value, currency = 'USD') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function useHumanize(t) {
  return useMemo(
    () => ({
      bool: (value) => (value === '' || value == null ? null : isTrue(value)),
      duration: (value) => {
        const d = parseIsoDuration(value);
        if (!d) return value || '—';
        if (d.days) return t('listingDetailPage.ui.daysHours', { days: d.days, hours: d.hours });
        if (d.hours) return t('listingDetailPage.ui.hoursMinutes', { hours: d.hours, minutes: d.minutes });
        return t('listingDetailPage.ui.minutes', { minutes: d.minutes });
      },
      listingDuration: (value) => {
        if (!value) return '—';
        if (value === 'GTC') return t('listingDetailPage.ui.untilCancelled');
        const days = String(value).match(/^Days_(\d+)$/);
        return days ? t('listingDetailPage.ui.days', { count: Number(days[1]) }) : value;
      },
      returnsWithin: (value) => {
        const days = String(value || '').match(/(\d+)/);
        return days ? t('listingDetailPage.ui.days', { count: Number(days[1]) }) : value || '—';
      },
      party: (value) => {
        const v = String(value || '').toLowerCase();
        if (v === 'seller') return t('listingDetailPage.ui.seller');
        if (v === 'buyer') return t('listingDetailPage.ui.buyer');
        return value || '—';
      },
      returnsAccepted: (value) => {
        if (!value) return null;
        return /notaccepted/i.test(value) ? false : /accepted/i.test(value) ? true : null;
      },
      protection: (value) => {
        if (!value) return '—';
        if (/ineligible/i.test(value)) return t('listingDetailPage.ui.ineligible');
        if (/eligible/i.test(value)) return t('listingDetailPage.ui.eligible');
        return value;
      },
      shipTo: (value) => {
        if (!value) return '—';
        return value
          .split(',')
          .map((code) => code.trim())
          .map((code) => (code === 'US' ? t('listingDetailPage.ui.usa') : code === 'Worldwide' ? t('listingDetailPage.ui.worldwide') : code))
          .join(', ');
      },
    }),
    [t]
  );
}

// ── Small presentational pieces ──────────────────────────────────────────────

function BoolPill({ value, isDark, t }) {
  if (value === null || value === undefined) return <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        value
          ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
          : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {value ? <Check size={11} /> : null}
      {value ? t('listingDetailPage.ui.yes') : t('listingDetailPage.ui.no')}
    </span>
  );
}

function DetailRow({ label, children, isDark }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 text-sm ${isDark ? 'border-slate-800' : 'border-slate-100'} border-b last:border-b-0`}>
      <dt className={isDark ? 'text-slate-400' : 'text-slate-500'}>{label}</dt>
      <dd className={`text-right font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{children}</dd>
    </div>
  );
}

function SectionCard({ icon: Icon, title, isDark, children, accent = 'text-indigo-500' }) {
  return (
    <section className={`rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        <Icon size={16} className={accent} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiTile({ icon: Icon, label, value, sub, tone = 'neutral', isDark }) {
  const valueTone = {
    neutral: isDark ? 'text-slate-100' : 'text-slate-900',
    danger: 'text-rose-500',
    success: 'text-emerald-500',
  }[tone];
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        <Icon size={12} />
        {label}
      </div>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      {sub ? <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p> : null}
    </div>
  );
}

function EditField({ label, hint, counter, children, isDark }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</label>
        {counter}
      </div>
      {children}
      {hint ? <p className={`mt-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{hint}</p> : null}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const { isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const humanize = useHumanize(t);
  const location = useLocation();
  const { listingId: routeListingId } = useParams();
  const initialListing = location?.state?.listing || null;
  const [listing, setListing] = useState(initialListing);
  const [listingLoading, setListingLoading] = useState(!initialListing && Boolean(routeListingId));
  const [selectedImage, setSelectedImage] = useState('');
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [titleDraft, setTitleDraft] = useState('');
  const [priceDraft, setPriceDraft] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('');
  const [saveTitleLoading, setSaveTitleLoading] = useState(false);
  const [savePriceLoading, setSavePriceLoading] = useState(false);
  const [saveQtyLoading, setSaveQtyLoading] = useState(false);
  const [autoStockEnabled, setAutoStockEnabled] = useState(false);
  const [autoStockQuantity, setAutoStockQuantity] = useState('');
  const [autoStockLoading, setAutoStockLoading] = useState(false);
  const [autoStockSaving, setAutoStockSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [matchedProduct, setMatchedProduct] = useState(null);
  const [idCopied, setIdCopied] = useState(false);
  const skipQuantityDraftSyncRef = useRef(false);
  const quantityInputRef = useRef(null);

  const keyFacts = useMemo(() => {
    if (!listing) return {};
    const priceValue = listing?.pricingSummary?.price?.value;
    const priceCurrency = listing?.pricingSummary?.price?.currency;
    return {
      listingId: listing?.listingId || listing?.listing?.listingId || listing?.sku || '-',
      title: listing?.listing?.title || listing?.title || listing?.product?.title || '-',
      status: listing?.status || listing?.marketplaceId || '-',
      price: priceValue != null ? `${priceValue} ${priceCurrency || ''}`.trim() : '-',
      priceValue: priceValue != null ? Number(priceValue) : null,
      currency: priceCurrency || 'USD',
      quantity:
        typeof listing?.availableQuantity === 'number'
          ? listing.availableQuantity
          : listing?.quantity ?? listing?.availability?.shipToLocationAvailability?.quantity ?? '-',
      url: listing?.url || listing?.listing?.listingWebUrl || null,
      source: listing?._source || listing?.source || '-',
      watchCount: listing?.watchCount ?? listing?.listing?.watchCount ?? null,
    };
  }, [listing]);
  const listingId = keyFacts.listingId;

  const meta = useMemo(() => {
    if (!listing) return {};
    return {
      site: listing?.site || listing?.marketplaceId || 'eBay',
      category: listing?.primaryCategory?.name || listing?.categoryName || '',
      created: listing?.listingStartDate || listing?.startTime || null,
      ended: listing?.listingEndDate || listing?.endTime || null,
      condition: listing?.conditionDisplayName || listing?.condition || '',
      location: listing?.location || listing?.itemLocation || '',
    };
  }, [listing]);

  const trading = useMemo(() => {
    const xml = listing?.rawXml;
    if (!xml || typeof DOMParser === 'undefined') return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const root = doc.querySelector('Item') || doc;
      const text = (selector) => root.querySelector(selector)?.textContent?.trim() || '';
      const allText = (selector) =>
        Array.from(root.querySelectorAll(selector))
          .map((n) => n.textContent?.trim())
          .filter(Boolean);
      const money = (selector) => {
        const n = root.querySelector(selector);
        if (!n) return '';
        const value = n.textContent?.trim() || '';
        const currency = n.getAttribute('currencyID') || text('Currency');
        return value ? `${value} ${currency || ''}`.trim() : '';
      };
      return {
        autoPay: text('AutoPay'),
        buyerProtection: text('BuyerProtection'),
        country: text('Country'),
        listingDuration: text('ListingDuration'),
        startTime: text('ListingDetails > StartTime'),
        endTime: text('ListingDetails > EndTime'),
        timeLeft: text('TimeLeft'),
        viewUrl: text('ListingDetails > ViewItemURL') || text('ListingDetails > ViewItemURLForNaturalSearch'),
        location: text('Location'),
        postalCode: text('PostalCode'),
        site: text('Site'),
        shipToLocations: allText('ShipToLocations').join(', '),
        quantity: text('Quantity'),
        quantitySold: text('SellingStatus > QuantitySold'),
        listingStatus: text('SellingStatus > ListingStatus'),
        bidCount: text('SellingStatus > BidCount'),
        currentPrice: money('SellingStatus > CurrentPrice'),
        minimumToBid: money('SellingStatus > MinimumToBid'),
        bestOfferCount: text('BestOfferDetails > BestOfferCount'),
        bestOfferEnabled: text('BestOfferDetails > BestOfferEnabled'),
        returnsAccepted: text('ReturnPolicy > ReturnsAccepted'),
        returnsWithin: text('ReturnPolicy > ReturnsWithin'),
        shippingPaidBy: text('ReturnPolicy > ShippingCostPaidBy'),
        condition: text('ConditionDisplayName'),
        categoryId: text('PrimaryCategory > CategoryID'),
        categoryName: text('PrimaryCategory > CategoryName'),
        sellerShippingProfile: text('SellerProfiles > SellerShippingProfile > ShippingProfileName'),
        sellerReturnProfile: text('SellerProfiles > SellerReturnProfile > ReturnProfileName'),
        sellerPaymentProfile: text('SellerProfiles > SellerPaymentProfile > PaymentProfileName'),
        secureDescription: text('IsSecureDescription'),
        hideFromSearch: text('HideFromSearch'),
        locationDefaulted: text('LocationDefaulted'),
        buyerResponsibleShipping: text('BuyerResponsibleForShipping'),
        pictureUrls: allText('PictureDetails > PictureURL'),
        watchCount: text('WatchCount'),
      };
    } catch {
      return null;
    }
  }, [listing]);

  const stockCount = useMemo(() => {
    const hasTradingQty = trading?.quantity != null && trading?.quantity !== '';
    const totalQtyRaw = hasTradingQty
      ? Number(trading.quantity)
      : Number(
          listing?.quantity ??
            listing?.availableQuantity ??
            listing?.availability?.shipToLocationAvailability?.quantity
        );
    const soldRaw = trading?.quantitySold != null && trading?.quantitySold !== '' ? Number(trading.quantitySold) : 0;
    if (Number.isFinite(totalQtyRaw)) {
      return Math.max(0, totalQtyRaw - (Number.isFinite(soldRaw) ? soldRaw : 0));
    }
    return keyFacts.quantity;
  }, [trading?.quantity, trading?.quantitySold, listing, keyFacts.quantity]);

  // Only real image URLs, de-duplicated; images that fail to load drop out.
  const gallery = useMemo(() => {
    const images = [];
    if (Array.isArray(listing?.pictures)) images.push(...listing.pictures);
    if (listing?.pictureUrl && Array.isArray(listing.pictureUrl)) images.push(...listing.pictureUrl);
    if (listing?.pictureDetails?.pictureUrl && Array.isArray(listing.pictureDetails.pictureUrl)) {
      images.push(...listing.pictureDetails.pictureUrl);
    }
    if (trading?.pictureUrls?.length) images.push(...trading.pictureUrls);
    if (listing?.image?.imageUrl) images.push(listing.image.imageUrl);
    const valid = images
      .map((src) => (typeof src === 'string' ? src : src?.imageUrl || src?.url || ''))
      .map((src) => String(src || '').trim())
      .filter((src) => /^https?:\/\//i.test(src));
    return Array.from(new Set(valid)).slice(0, 24);
  }, [listing, trading]);
  const images = gallery.filter((src) => !brokenImages.has(src));
  const activeImage = images.includes(selectedImage) ? selectedImage : images[0] || '';
  const activeIndex = Math.max(0, images.indexOf(activeImage));
  const markBroken = (src) => setBrokenImages((prev) => new Set(prev).add(src));

  useEffect(() => {
    setSelectedImage(gallery[0] || '');
  }, [gallery]);

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  // Opened via a direct link (e.g. the dashboard's Action Center) without the
  // listing in router state — find it in the user's listings instead.
  useEffect(() => {
    if (initialListing || !routeListingId) return undefined;
    let cancelled = false;
    setListingLoading(true);
    ebayAPI
      .getListings(0, 200)
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const wanted = String(routeListingId);
        const found = items.find((item) =>
          [item?.listingId, item?.listing?.listingId, item?.listing?.legacyItemId, item?.offerId, item?.sku].some((v) => String(v || '') === wanted)
        );
        setListing(found || null);
      })
      .catch(() => !cancelled && setListing(null))
      .finally(() => !cancelled && setListingLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initialListing, routeListingId]);

  // The Products-page product this listing belongs to (powers the profit card).
  useEffect(() => {
    if (!listingId || listingId === '-') return undefined;
    let cancelled = false;
    productAPI
      .getAll()
      .then((res) => {
        if (cancelled) return;
        const products = Array.isArray(res?.data) ? res.data : [];
        setMatchedProduct(products.find((p) => String(p?.ebayItemId || '').trim() === String(listingId)) || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    const currentTitle = listing?.listing?.title || listing?.title || listing?.product?.title || '';
    const currentPrice =
      listing?.pricingSummary?.price?.value ??
      (trading?.currentPrice ? String(trading.currentPrice).split(' ')[0] : '');
    setTitleDraft(currentTitle);
    setPriceDraft(currentPrice ? String(currentPrice) : '');
    if (skipQuantityDraftSyncRef.current) {
      skipQuantityDraftSyncRef.current = false;
      return;
    }
    setQuantityDraft(stockCount !== '' && stockCount != null ? String(stockCount) : '');
  }, [listing, trading?.currentPrice, stockCount]);

  useEffect(() => {
    if (!listingId || listingId === '-') return;

    let active = true;
    setAutoStockLoading(true);

    ebayAPI
      .getListingAutoStockRule(listingId)
      .then((response) => {
        if (!active) return;
        const rule = response?.data?.data || null;
        if (rule) {
          setAutoStockEnabled(Boolean(rule.isEnabled));
          setAutoStockQuantity(rule.assignedQuantity != null ? String(rule.assignedQuantity) : '');
        } else {
          setAutoStockEnabled(false);
          setAutoStockQuantity('');
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err?.response?.status !== 404) {
          setSaveError(err?.response?.data?.error || err?.message || 'Failed to load auto stock rule.');
        }
      })
      .finally(() => {
        if (active) setAutoStockLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingId]);

  const handleUpdateTitle = async () => {
    const listingId = keyFacts.listingId;
    if (!listingId || listingId === '-') return;
    if (!titleDraft.trim()) {
      setSaveError(t('listingDetailPage.emptyTitle'));
      setSaveSuccess('');
      return;
    }
    setSaveTitleLoading(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await ebayAPI.updateListing(listingId, { title: titleDraft.trim() });
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: titleDraft.trim(),
          listing: {
            ...(prev.listing || {}),
            title: titleDraft.trim(),
          },
        };
      });
      setSaveSuccess(t('listingDetailPage.titleUpdated'));
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || t('listingDetailPage.failedUpdateTitle'));
    } finally {
      setSaveTitleLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    const listingId = keyFacts.listingId;
    if (!listingId || listingId === '-') return;
    const parsed = Number(priceDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSaveError(t('listingDetailPage.enterValidPrice'));
      setSaveSuccess('');
      return;
    }
    setSavePriceLoading(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await ebayAPI.updateListing(listingId, { price: parsed, currency: 'USD' });
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pricingSummary: {
            ...(prev.pricingSummary || {}),
            price: {
              value: parsed.toFixed(2),
              currency: 'USD',
            },
          },
        };
      });
      setSaveSuccess(t('listingDetailPage.priceUpdated'));
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || t('listingDetailPage.failedUpdatePrice'));
    } finally {
      setSavePriceLoading(false);
    }
  };

  const handleUpdateQuantity = async () => {
    if (!listingId || listingId === '-') return;
    const parsedStock = Number(quantityDraft);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setSaveError(t('listingDetailPage.enterValidQuantity'));
      setSaveSuccess('');
      return;
    }
    const quantityToSend = parsedStock;
    setSaveQtyLoading(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      skipQuantityDraftSyncRef.current = true;
      await ebayAPI.updateListing(listingId, { quantity: quantityToSend });
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          quantity: quantityToSend,
          availableQuantity: quantityToSend,
          availability: {
            ...(prev.availability || {}),
            shipToLocationAvailability: {
              ...((prev.availability || {}).shipToLocationAvailability || {}),
              quantity: quantityToSend,
            },
          },
        };
      });
      setQuantityDraft(String(parsedStock));
      setSaveSuccess(t('listingDetailPage.quantityUpdated'));
    } catch (err) {
      skipQuantityDraftSyncRef.current = false;
      setSaveError(err?.response?.data?.error || err?.message || t('listingDetailPage.failedUpdateQuantity'));
    } finally {
      setSaveQtyLoading(false);
    }
  };

  const handleSaveAutoStockRule = async () => {
    if (!listingId || listingId === '-') return;
    const parsedAutoStock = Number(autoStockQuantity);
    if (!Number.isInteger(parsedAutoStock) || parsedAutoStock <= 0) {
      setSaveError(t('listingDetailPage.enterValidAutoStock'));
      setSaveSuccess('');
      return;
    }

    setAutoStockSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const response = await ebayAPI.saveListingAutoStockRule(listingId, {
        enabled: true,
        assignedQuantity: parsedAutoStock,
      });
      const rule = response?.data?.data || null;
      setAutoStockEnabled(true);
      setAutoStockQuantity(rule?.assignedQuantity != null ? String(rule.assignedQuantity) : String(parsedAutoStock));
      setSaveSuccess(t('listingDetailPage.autoStockSaved'));
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || t('listingDetailPage.failedAutoStock'));
    } finally {
      setAutoStockSaving(false);
    }
  };

  const handleAutoStockToggle = async (event) => {
    const nextEnabled = event.target.checked;
    setSaveError('');
    setSaveSuccess('');

    if (nextEnabled) {
      setAutoStockEnabled(true);
      if (!autoStockQuantity) {
        setAutoStockQuantity(quantityDraft !== '' ? String(quantityDraft) : '1');
      }
      return;
    }

    if (!listingId || listingId === '-') {
      setAutoStockEnabled(false);
      setAutoStockQuantity('');
      return;
    }

    setAutoStockSaving(true);
    try {
      await ebayAPI.deleteListingAutoStockRule(listingId);
      setAutoStockEnabled(false);
      setAutoStockQuantity('');
      setSaveSuccess(t('listingDetailPage.autoStockRemoved'));
    } catch (err) {
      setAutoStockEnabled(true);
      setSaveError(err?.response?.data?.error || err?.message || t('listingDetailPage.failedAutoStock'));
    } finally {
      setAutoStockSaving(false);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(String(listingId));
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    } catch {
      // clipboard blocked — the id stays visible
    }
  };

  // ── Derived view data ──────────────────────────────────────────────────────

  const currentTitle = listing?.listing?.title || listing?.title || listing?.product?.title || '';
  const currentPriceValue = keyFacts.priceValue ?? (trading?.currentPrice ? Number(String(trading.currentPrice).split(' ')[0]) : null);
  const currency = keyFacts.currency || 'USD';
  const statusRaw = String(trading?.listingStatus || keyFacts.status || '').toLowerCase();
  const isActive = statusRaw === 'active' || statusRaw === 'published';
  const isEnded = /ended|completed|inactive/.test(statusRaw);
  const stockNumber = Number(stockCount);
  const outOfStock = Number.isFinite(stockNumber) && stockNumber <= 0;
  const hiddenFromSearch = isTrue(trading?.hideFromSearch);
  const sold = Number(trading?.quantitySold || 0);
  const watchers = Number(trading?.watchCount || keyFacts.watchCount || 0);
  const categoryPath = String(trading?.categoryName || meta.category || '').split(':').map((s) => s.trim()).filter(Boolean);

  const profitFor = (price) => {
    if (!matchedProduct || !Number(matchedProduct.currentAmazonPrice) || !Number(price)) return null;
    return calculateProfit(price, matchedProduct.currentAmazonPrice, {
      taxRate: 0.06,
      fvfRate: 0.136,
      adRate: (parseFloat(matchedProduct.adRate) || 0) / 100,
      fixedFee: 0.3,
    });
  };
  const currentProfit = profitFor(currentPriceValue);
  const draftProfit = profitFor(priceDraft);
  const margin = currentProfit !== null && currentPriceValue ? Math.round((currentProfit / currentPriceValue) * 100) : null;

  const titleDirty = titleDraft.trim() !== String(currentTitle).trim();
  const priceDirty = priceDraft !== '' && Number(priceDraft) !== Number(currentPriceValue);
  const qtyDirty = quantityDraft !== '' && Number(quantityDraft) !== Number(stockCount);

  const timeLeft = trading?.timeLeft ? humanize.duration(trading.timeLeft) : '—';
  const lang = i18n.language;

  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputCls = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const saveBtn = (dirty, loading, onClick, label) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
        dirty
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {loading ? t('listingDetailPage.ui.saving') : label || t('listingDetailPage.ui.save')}
    </button>
  );

  if (listingLoading) {
    return (
      <div className="page-shell">
        <div className={`${card} animate-pulse p-6`}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={`aspect-square rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <div className="space-y-4">
              <div className={`h-8 w-3/4 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className={`h-12 w-40 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className={`h-24 w-full rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="page-shell">
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="mb-4">{t('listingDetailPage.unavailable')}</p>
          <Link to="/listings" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            {t('listingDetailPage.backToListings')}
          </Link>
        </div>
      </div>
    );
  }

  const statusChip = isEnded
    ? { text: t('listingDetailPage.ui.statusEnded'), cls: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
    : isActive
      ? { text: t('listingDetailPage.ui.statusActive'), cls: isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
      : { text: trading?.listingStatus || keyFacts.status, cls: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };

  return (
    <div className="page-shell">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/listings" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          {t('listingDetailPage.back')}
        </Link>
        {keyFacts.url || trading?.viewUrl ? (
          <a
            href={keyFacts.url || trading.viewUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex items-center gap-2"
          >
            {t('listingDetailPage.viewOnEbay')}
            <ExternalLink size={16} />
          </a>
        ) : null}
      </div>

      {/* Hero */}
      <section className={`${card} mb-5 p-4 sm:p-6`}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Gallery */}
          <div className="lg:col-span-6">
            <div className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border ${isDark ? 'border-slate-800 bg-white' : 'border-slate-100 bg-white'}`}>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={keyFacts.title}
                  onError={() => markBroken(activeImage)}
                  className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-slate-400">
                  <ImageOff size={32} />
                  {t('listingDetailPage.noImage')}
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label={t('listingDetailPage.ui.prevImage')}
                    onClick={() => setSelectedImage(images[(activeIndex - 1 + images.length) % images.length])}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-md transition hover:bg-white group-hover:opacity-100"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={t('listingDetailPage.ui.nextImage')}
                    onClick={() => setSelectedImage(images[(activeIndex + 1) % images.length])}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-md transition hover:bg-white group-hover:opacity-100"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white">
                    {activeIndex + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSelectedImage(src)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                      src === activeImage ? 'border-indigo-500' : isDark ? 'border-slate-800 opacity-70 hover:opacity-100' : 'border-slate-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt="" onError={() => markBroken(src)} className="h-full w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusChip.dot}`} />
                {statusChip.text}
              </span>
              {outOfStock && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
                  <Package size={12} />
                  {t('listingDetailPage.ui.outOfStock')}
                </span>
              )}
              {hiddenFromSearch && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                  <EyeOff size={12} />
                  {t('listingDetailPage.ui.hiddenFromSearch')}
                </span>
              )}
              {autoStockEnabled && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                  <Zap size={12} />
                  {t('listingDetailPage.autoStock')}
                </span>
              )}
            </div>

            <h1 className={`mt-3 text-2xl font-bold leading-snug sm:text-[28px] ${strong}`}>{keyFacts.title}</h1>

            <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${muted}`}>
              <button type="button" onClick={handleCopyId} className="inline-flex items-center gap-1.5 font-mono transition hover:text-indigo-500" title={t('listingDetailPage.ui.copyId')}>
                #{listingId}
                {idCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
              {(trading?.condition || meta.condition) && <span>· {trading?.condition || meta.condition}</span>}
            </div>

            {categoryPath.length > 0 && (
              <nav aria-label={t('listingDetailPage.ui.category')} className={`mt-2 flex flex-wrap items-center gap-1 text-xs ${muted}`}>
                {categoryPath.map((part, i) => (
                  <React.Fragment key={`${part}-${i}`}>
                    {i > 0 && <ChevronRight size={12} className="opacity-60" />}
                    <span className={i === categoryPath.length - 1 ? `font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}` : ''}>{part}</span>
                  </React.Fragment>
                ))}
              </nav>
            )}

            <div className={`mt-5 flex flex-wrap items-end gap-x-4 gap-y-2 border-b pb-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{t('listingDetailPage.priceLabel')}</p>
                <p className={`text-4xl font-extrabold tracking-tight tabular-nums ${strong}`}>
                  {currentPriceValue != null ? money(currentPriceValue, currency) : trading?.currentPrice || keyFacts.price}
                </p>
              </div>
              {currentProfit !== null && (
                <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  currentProfit >= 0
                    ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                    : isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'
                }`}>
                  {t('listingDetailPage.ui.profitChip', { profit: `${currentProfit >= 0 ? '+' : '−'}${money(Math.abs(currentProfit))}`, margin })}
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile isDark={isDark} icon={Package} label={t('listingDetailPage.stockCountLabel')} value={Number.isFinite(stockNumber) ? stockNumber : '—'} tone={outOfStock ? 'danger' : 'neutral'} />
              <KpiTile isDark={isDark} icon={ShoppingBag} label={t('listingDetailPage.ui.sold')} value={sold} tone={sold > 0 ? 'success' : 'neutral'} />
              <KpiTile isDark={isDark} icon={Eye} label={t('listingDetailPage.ui.watchers')} value={watchers} sub={trading?.bestOfferCount ? t('listingDetailPage.ui.offers', { count: Number(trading.bestOfferCount) }) : null} />
              <KpiTile isDark={isDark} icon={Clock3} label={t('listingDetailPage.timeLeft')} value={<span className="text-base">{timeLeft}</span>} />
            </div>

            {/* Alerts */}
            <div className="mt-4 space-y-2">
              {outOfStock && isActive && (
                <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center ${isDark ? 'border-rose-500/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50'}`}>
                  <AlertTriangle size={18} className="shrink-0 text-rose-500" />
                  <p className={`flex-1 text-sm ${isDark ? 'text-rose-200' : 'text-rose-800'}`}>{t('listingDetailPage.ui.alertOutOfStock')}</p>
                  <button
                    type="button"
                    onClick={() => quantityInputRef.current?.focus()}
                    className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    {t('listingDetailPage.ui.alertOutOfStockCta')}
                  </button>
                </div>
              )}
              {hiddenFromSearch && !outOfStock && (
                <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <EyeOff size={18} className="shrink-0 text-amber-500" />
                  {t('listingDetailPage.ui.alertHidden')}
                </div>
              )}
              {currentProfit !== null && currentProfit < 0 && (
                <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                  <CircleDollarSign size={18} className="shrink-0 text-rose-500" />
                  {t('listingDetailPage.ui.alertLoss', { cost: money(matchedProduct?.currentAmazonPrice) })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Details */}
        <div className="space-y-5 lg:col-span-2">
          {matchedProduct && (
            <SectionCard icon={CircleDollarSign} title={t('listingDetailPage.ui.profitTitle')} isDark={isDark} accent="text-emerald-500">
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile isDark={isDark} icon={ShoppingBag} label={t('listingDetailPage.ui.amazonCost')} value={money(matchedProduct.currentAmazonPrice)} />
                <KpiTile
                  isDark={isDark}
                  icon={CircleDollarSign}
                  label={t('listingDetailPage.ui.estProfit')}
                  value={currentProfit === null ? '—' : `${currentProfit >= 0 ? '+' : '−'}${money(Math.abs(currentProfit))}`}
                  tone={currentProfit === null ? 'neutral' : currentProfit >= 0 ? 'success' : 'danger'}
                />
                <KpiTile isDark={isDark} icon={Zap} label={t('listingDetailPage.ui.margin')} value={margin === null ? '—' : `${margin}%`} tone={margin === null ? 'neutral' : margin >= 0 ? 'success' : 'danger'} />
              </div>
              <p className={`mt-3 text-xs ${muted}`}>{t('listingDetailPage.ui.profitNote')}</p>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <SectionCard icon={Truck} title={t('listingDetailPage.ui.shippingTitle')} isDark={isDark}>
              <dl>
                <DetailRow isDark={isDark} label={t('listingDetailPage.shipsTo')}>{humanize.shipTo(trading?.shipToLocations)}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.location')}>
                  {[trading?.location || meta.location, trading?.postalCode].filter(Boolean).join(', ') || '—'}
                </DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.returnsAccepted')}>
                  <BoolPill value={humanize.returnsAccepted(trading?.returnsAccepted)} isDark={isDark} t={t} />
                </DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.returnWindow')}>{humanize.returnsWithin(trading?.returnsWithin)}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.returnShippingPaidBy')}>{humanize.party(trading?.shippingPaidBy)}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.buyerProtection')}>{humanize.protection(trading?.buyerProtection)}</DetailRow>
              </dl>
            </SectionCard>

            <SectionCard icon={Settings2} title={t('listingDetailPage.ui.settingsTitle')} isDark={isDark} accent="text-violet-500">
              <dl>
                <DetailRow isDark={isDark} label={t('listingDetailPage.listingDuration')}>{humanize.listingDuration(trading?.listingDuration)}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.start')}>{formatLongDate(trading?.startTime || meta.created, lang) || '—'}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.ui.renews')}>{formatLongDate(trading?.endTime || meta.ended, lang) || '—'}</DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.bestOffer')}>
                  <BoolPill value={humanize.bool(trading?.bestOfferEnabled)} isDark={isDark} t={t} />
                </DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.autoPay')}>
                  <BoolPill value={humanize.bool(trading?.autoPay)} isDark={isDark} t={t} />
                </DetailRow>
                <DetailRow isDark={isDark} label={t('listingDetailPage.ui.visibleInSearch')}>
                  <BoolPill value={trading?.hideFromSearch ? !hiddenFromSearch : null} isDark={isDark} t={t} />
                </DetailRow>
              </dl>
            </SectionCard>
          </div>

          <SectionCard icon={Briefcase} title={t('listingDetailPage.sellerProfilesTitle')} isDark={isDark} accent="text-sky-500">
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [Truck, t('listingDetailPage.shipping'), trading?.sellerShippingProfile],
                [Package, t('listingDetailPage.returning'), trading?.sellerReturnProfile],
                [CircleDollarSign, t('listingDetailPage.ui.paymentProfile'), trading?.sellerPaymentProfile],
              ].map(([Icon, label, value]) => (
                <div key={label} className={`rounded-xl border px-3.5 py-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>
                    <Icon size={12} />
                    {label}
                  </p>
                  <p className={`mt-1 truncate text-sm font-semibold ${strong}`} title={value || ''}>{value || '—'}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Quick edit */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className={`${card} p-5`}>
            <h2 className={`text-base font-semibold ${strong}`}>{t('listingDetailPage.quickEditTitle')}</h2>
            <p className={`mt-0.5 text-xs ${muted}`}>{t('listingDetailPage.ui.quickEditHint')}</p>

            {(saveError || saveSuccess) && (
              <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                saveError
                  ? isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
                  : isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {saveError ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <Check size={14} className="mt-0.5 shrink-0" />}
                {saveError || saveSuccess}
              </div>
            )}

            <div className="mt-5 space-y-5">
              <EditField
                isDark={isDark}
                label={t('listingDetailPage.titleLabel')}
                counter={
                  <span className={`text-[11px] font-semibold tabular-nums ${titleDraft.length > TITLE_MAX ? 'text-rose-500' : titleDraft.length > TITLE_MAX - 10 ? 'text-amber-500' : muted}`}>
                    {titleDraft.length}/{TITLE_MAX}
                  </span>
                }
              >
                <textarea
                  rows={3}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className={`${inputCls} resize-none leading-relaxed`}
                />
                <div className="mt-2 flex justify-end">
                  {saveBtn(titleDirty && titleDraft.length <= TITLE_MAX, saveTitleLoading, handleUpdateTitle)}
                </div>
              </EditField>

              <EditField
                isDark={isDark}
                label={t('listingDetailPage.priceLabel2')}
                hint={
                  draftProfit !== null && priceDirty
                    ? <span className={draftProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{t('listingDetailPage.ui.priceProfitHint', { profit: `${draftProfit >= 0 ? '+' : '−'}${money(Math.abs(draftProfit))}` })}</span>
                    : null
                }
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${muted}`}>$</span>
                    <input type="number" min="0" step="0.01" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className={`${inputCls} pl-7 tabular-nums`} />
                  </div>
                  {saveBtn(priceDirty, savePriceLoading, handleUpdatePrice)}
                </div>
              </EditField>

              <EditField isDark={isDark} label={t('listingDetailPage.stockCountLabel2')}>
                <div className="flex gap-2">
                  <div className={`flex flex-1 items-center rounded-xl border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-white'}`}>
                    <button
                      type="button"
                      aria-label="-1"
                      onClick={() => setQuantityDraft(String(Math.max(0, (Number(quantityDraft) || 0) - 1)))}
                      className={`flex h-10 w-10 items-center justify-center rounded-l-xl transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      ref={quantityInputRef}
                      type="number"
                      min="0"
                      step="1"
                      value={quantityDraft}
                      onChange={(e) => setQuantityDraft(e.target.value)}
                      className={`w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums outline-none ${strong}`}
                    />
                    <button
                      type="button"
                      aria-label="+1"
                      onClick={() => setQuantityDraft(String((Number(quantityDraft) || 0) + 1))}
                      className={`flex h-10 w-10 items-center justify-center rounded-r-xl transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  {saveBtn(qtyDirty, saveQtyLoading, handleUpdateQuantity)}
                </div>
              </EditField>

              {/* Auto stock */}
              <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${strong}`}>
                      <Zap size={14} className="text-indigo-500" />
                      {t('listingDetailPage.autoStock')}
                    </p>
                    <p className={`mt-1 text-xs leading-relaxed ${muted}`}>{t('listingDetailPage.autoStockDescription')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoStockEnabled}
                    aria-label={t('listingDetailPage.autoStock')}
                    disabled={autoStockSaving || autoStockLoading}
                    onClick={() => handleAutoStockToggle({ target: { checked: !autoStockEnabled } })}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${autoStockEnabled ? 'bg-indigo-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${autoStockEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {autoStockLoading && <p className={`mt-2 text-xs ${muted}`}>{t('listingDetailPage.loadingAutoStock')}</p>}
                {autoStockEnabled && (
                  <div className="mt-3">
                    <label className={`mb-1.5 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('listingDetailPage.autoStockCount')}</label>
                    <div className="flex gap-2">
                      <input type="number" min="1" step="1" value={autoStockQuantity} onChange={(e) => setAutoStockQuantity(e.target.value)} className={`${inputCls} tabular-nums`} />
                      {saveBtn(Boolean(autoStockQuantity), autoStockSaving, handleSaveAutoStockRule)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
