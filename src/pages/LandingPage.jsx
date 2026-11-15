import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Globe2,
  Puzzle,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Truck,
  Smartphone,
  Download,
  Apple,
  Package,
  EyeOff,
  ClipboardList,
  ShoppingCart,
  Star,
  X,
  Loader2,
  Menu,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { partnerAPI, settingsAPI, API_BASE_URL } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import PartnersSection from '../components/PartnersSection';
import { applySeo } from '../utils/seo';
import { pathFor, SUPPORTED_LANGS, SEO_PAGES, imageFor } from '../data/seoPages';
import MilliNetBadge, { TRUST_BADGE_CARD } from '../components/marketing/MilliNetBadge';
import { renderAccentedTitle } from '../utils/accentedTitle';
import { useScrollReveal, SCROLL_REVEAL_CSS } from '../utils/scrollReveal';
import { TrackingMock, MarketAnalysisMock } from '../components/marketing/ShowcaseMocks';
import AppsSection from '../components/marketing/AppsSection';
import CtaCarouselSection from '../components/marketing/CtaCarouselSection';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/checkila-extension/mokpdmidbgchibehajdblfkjcgcibcbb';
const TELEGRAM_BOT_URL = 'https://t.me/Checkila_bot';

// Soft glow colour behind each platform-number card.
const STAT_GLOW = {
  productsTracked: '#f97316',
  trackingCodes: '#3b82f6',
  marketCredits: '#8b5cf6',
  aiActions: '#ec4899',
  managedListings: '#6366f1',
  managedOrders: '#f43f5e',
};

// Counts up from 0 the first time it scrolls into view (instant with reduced motion).
function AnimatedNumber({ value, duration = 1400 }) {
  const target = Number(value);
  const ref = React.useRef(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setShown(target);
      return undefined;
    }
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target, duration]);
  if (!Number.isFinite(target)) return <span>—</span>;
  return <span ref={ref}>{shown.toLocaleString('en-US')}</span>;
}

// renderAccentedTitle: utils/accentedTitle.jsx (shared with PartnersSection).
const MOBILE_APK_URL = `${API_BASE_URL}/uploads/checkila.apk`;

function ReviewsModal({ open, onClose, isDark }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    settingsAPI
      .getPublicReviews()
      .then((res) => {
        if (!cancelled) setReviews(res?.data?.reviews || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Rəylər yüklənmədi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[1.5rem] border p-6 shadow-2xl ${
          isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex flex-shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold">İstifadəçi rəyləri</h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-1.5 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : reviews.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hələ rəy yoxdur.</p>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.fullName}</span>
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={13}
                        className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                      />
                    ))}
                  </span>
                </div>
                {r.reviewText && (
                  <p className={`mt-1.5 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {r.reviewText}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, align = 'left' }) {
  const alignClasses = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`flex flex-col gap-3 ${alignClasses}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 dark:border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100">
        {eyebrow}
      </div>
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-5xl">{title}</h2>
      <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">{description}</p>
    </div>
  );
}

function LanguageSelector() {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English (EN)' },
    { code: 'az', label: 'Azərbaycanca (AZ)' },
    { code: 'ru', label: 'Русский (RUS)' },
    { code: 'tr', label: 'Türkçe (TÜR)' },
  ];

  const currentLangLabel = languages.find((lang) => lang.code === currentLanguage)?.label || 'English';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-white/25 dark:hover:bg-white/15"
      >
        <Globe2 size={16} />
        <span className="hidden sm:inline">{currentLangLabel.split(' ')[0]}</span>
        <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden dark:border-white/15 dark:bg-slate-900">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-medium transition ${
                currentLanguage === lang.code
                  ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A plan feature line that describes the tracking credits ("60 credit for Tracking",
// "300 tracking credits", "izləmə krediti"…). Struck through while the plan's own
// tracking add-on is unticked, because those credits only come with the add-on.
const TRACKING_FEATURE_RE = /(tracking|izl[əe]m[əe]|izleme|takip|отслеж|трек)/i;
const CREDIT_WORD_RE = /(credit|kredit|кредит)/i;
const isTrackingCreditFeature = (text) => TRACKING_FEATURE_RE.test(text) && CREDIT_WORD_RE.test(text);

// Markup on the tracking add-on inside the struck-through "was" price.
const TRACKING_ADDON_LIST_MARKUP = 0.2;

function PlanCard({ plan, onSubscribe }) {
  const { formatPrice } = useLanguage();
  const { t } = useTranslation('pricing');
  // The add-on is pre-selected; unticking it strikes the tracking-credit feature.
  const [includeTracking, setIncludeTracking] = useState(true);
  const featured = !!plan.featured;

  const hasDiscount =
    plan.actualPrice != null &&
    plan.discountedPrice != null &&
    Number.isFinite(Number(plan.actualPrice)) &&
    Number.isFinite(Number(plan.discountedPrice)) &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);

  // A Subscription-category plan can carry its own individually-priced tracking
  // add-on (trackingAddonPrice + trackingCreditsLimit set directly on the plan by
  // admin) — same eligibility rule used in the request modal and Upgrade Plan page.
  const ownTrackingAddon = (() => {
    if (plan.category !== 'subscription') return null;
    const price = plan.trackingAddonPrice;
    const credits = Number(plan.trackingCreditsLimit);
    if (price === null || price === undefined || !Number.isFinite(Number(price))) return null;
    if (!Number.isFinite(credits) || credits <= 0) return null;
    return { price: Number(price), credits };
  })();
  // Trial plans always come with their tracking add-on — no checkbox, never unticked.
  const isTrialPlan = /trial/i.test(String(plan.name || ''));
  const addonOn = (includeTracking || isTrialPlan) && !!ownTrackingAddon;

  // Combine in AZN first, then convert once — never convert the plan price and the
  // add-on price separately and add the converted numbers, which would compound
  // rounding and break the currency logic.
  const baseAzn = hasDiscount
    ? Number(plan.discountedPrice)
    : plan.actualPrice != null
      ? Number(plan.actualPrice)
      : Number(plan.price?.match(/[\d.]+/)?.[0] || 0);
  const addonAzn = addonOn ? ownTrackingAddon.price : 0;
  const totalAzn = baseAzn + addonAzn;
  const totalDisplay = formatPrice(totalAzn);

  // Struck-through "was" price: the admin's full plan price, plus — when the tracking
  // add-on is ticked — the add-on price marked up by 20% (e.g. 11.99 + 8.99 × 1.2).
  const listAzn =
    (plan.actualPrice != null && Number.isFinite(Number(plan.actualPrice)) ? Number(plan.actualPrice) : baseAzn) +
    (addonOn ? ownTrackingAddon.price * (1 + TRACKING_ADDON_LIST_MARKUP) : 0);
  const discountPercent = listAzn > totalAzn ? Math.round(((listAzn - totalAzn) / listAzn) * 100) : 0;
  const showListPrice = discountPercent > 0;

  const muted = featured ? 'text-cyan-50/80' : 'text-slate-500 dark:text-slate-400';

  return (
    <article
      className={`group relative flex h-full flex-col rounded-[1.75rem] p-2 transition duration-300 hover:-translate-y-1 ${
        featured
          ? 'bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 shadow-2xl shadow-cyan-500/25 ring-1 ring-cyan-400/40'
          : 'border border-slate-200/80 bg-slate-50/90 shadow-sm hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30'
      }`}
    >
      {featured && (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]" aria-hidden="true">
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
          </div>
          <span className="absolute -top-3 right-6 z-10 rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold text-slate-900 shadow-md shadow-amber-500/30">
            {t('planCard.featured')}
          </span>
        </>
      )}

      {/* Top: name, price, add-on, CTA */}
      <div className="relative px-4 pb-5 pt-5">
        <h3 className={`text-lg font-semibold ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
        {plan.summary && <p className={`mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-5 ${muted}`}>{plan.summary}</p>}

        <div className="mt-5 flex min-h-[1.5rem] flex-wrap items-center gap-2">
          {showListPrice && (
            <>
              <span className={`text-sm line-through ${featured ? 'text-cyan-50/70' : 'text-slate-400'}`}>{formatPrice(listAzn)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  featured ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300'
                }`}
              >
                {t('pricing:planCard.save', { percent: discountPercent })}
              </span>
            </>
          )}
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-4xl font-bold tracking-tight tabular-nums ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{totalDisplay}</span>
          {plan.duration && <span className={`text-sm ${muted}`}>/ {plan.duration.toLowerCase()}</span>}
        </p>

        {ownTrackingAddon && !isTrialPlan && (
          <label
            className={`mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
              featured
                ? 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/20'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-cyan-400/50 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/10'
            }`}
          >
            <input
              type="checkbox"
              checked={includeTracking}
              onChange={(e) => setIncludeTracking(e.target.checked)}
              className={`mt-0.5 h-4 w-4 shrink-0 rounded ${featured ? 'accent-white' : 'accent-cyan-600'}`}
            />
            <span className="font-semibold leading-5">{t('pricing:planCard.includeTracking')}</span>
          </label>
        )}

        <button
          type="button"
          onClick={() => onSubscribe?.(plan, addonOn)}
          className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition ${
            featured
              ? 'bg-white text-blue-700 shadow-lg shadow-blue-900/20 hover:bg-cyan-50'
              : 'border border-slate-200 bg-white text-slate-900 hover:border-transparent hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 hover:text-white dark:border-white/15 dark:bg-white/5 dark:text-white'
          }`}
        >
          {t('planCard.subscribe')}
        </button>
      </div>

      {/* Bottom: features panel */}
      {plan.features.length > 0 && (
        <ul
          className={`relative flex-1 space-y-3 rounded-[1.35rem] p-5 text-sm ${
            featured ? 'bg-white text-slate-700 shadow-inner dark:bg-slate-950/90 dark:text-slate-100' : 'bg-white/80 text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-950/40 dark:text-slate-200 dark:ring-white/5'
          }`}
        >
          {plan.features.map((feature) => {
            const struck = !!ownTrackingAddon && !addonOn && isTrackingCreditFeature(feature);
            return (
              <li key={feature} className={`flex items-start gap-2.5 transition ${struck ? 'opacity-60' : ''}`}>
                {struck ? (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                )}
                <span className={struck ? 'text-slate-400 line-through decoration-slate-400' : ''}>{feature}</span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function normalizePlan(raw = {}) {
  const fallbackId = String(raw.name || 'plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const planName = raw.name || 'Plan';
  const isAdvantagePlan = /advantage/i.test(planName);
  const normalizedCategory = String(raw.category || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  return {
    id: raw.id || fallbackId,
    name: planName,
    duration: raw.duration || '',
    price: raw.price || '',
    actualPrice: raw.actualPrice ?? null,
    discountedPrice: raw.discountedPrice ?? null,
    currency: raw.currency || 'AZN',
    summary: raw.description || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    trackingCreditsLimit: raw.trackingCreditsLimit ?? null,
    trackingAddonPrice: raw.trackingAddonPrice ?? null,
    category:
      normalizedCategory === 'analytics' || normalizedCategory === 'analysis' || normalizedCategory === 'data_analytics'
        ? 'analytics'
        : normalizedCategory === 'amazon_monitoring' || normalizedCategory === 'amazonmonitoring'
        ? 'amazon_monitoring'
        : normalizedCategory === 'tracking_plans' || normalizedCategory === 'tracking_plan' || normalizedCategory === 'trackingplans'
        ? 'tracking_plans'
        : normalizedCategory === 'support'
        ? 'support'
        : 'subscription',
    featured: !!raw.featured,
    isActive: raw.isActive !== false,
    accent:
      normalizedCategory === 'analytics' || normalizedCategory === 'analysis' || normalizedCategory === 'data_analytics'
        ? 'from-violet-400/20 to-slate-700/10'
        : isAdvantagePlan
        ? 'from-amber-300/35 to-yellow-500/20'
        : raw.featured
        ? 'from-cyan-400/35 to-blue-500/20'
        : 'from-sky-400/25 to-indigo-500/15',
  };
}

export default function LandingPage() {
  const { t, i18n } = useTranslation(['landing', 'common', 'pricing', 'seoPages']);
  const activeLangCode = (i18n.language || 'en').split('-')[0];
  const activeLang = SUPPORTED_LANGS.includes(activeLangCode) ? activeLangCode : 'en';
  const { changeLanguage } = useLanguage();
  const { isDark } = useTheme();
  const [openFaq, setOpenFaq] = useState(0);
  // Scroll-triggered entrance animations for everything tagged data-reveal(-stagger).
  const revealRootRef = useRef(null);
  useScrollReveal(revealRootRef);
  const [activeTab, setActiveTab] = useState('subscription');
  const [plans, setPlans] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [presetIncludeTracking, setPresetIncludeTracking] = useState(false);

  const faqItems = useMemo(
    () =>
      Array.from({ length: 9 }, (_, idx) => ({
        question: t(`landing:faq.items.${idx}.question`),
        answer: t(`landing:faq.items.${idx}.answer`),
      })).filter((item) => item.question && !item.question.startsWith('landing:faq')),
    [t]
  );

  useEffect(() => {
    applySeo({
      title: t('landing:seo.title'),
      description: t('landing:seo.description'),
      keywords: t('landing:seo.keywords'),
      canonical: 'https://checkila.com/',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Checkila',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: 'https://checkila.com/',
          description: t('landing:seo.description'),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        },
      ],
    });
  }, [faqItems, t]);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      try {
        const response = await settingsAPI.getPublicPlans();
        const apiPlans = (response?.data?.plans || []).map(normalizePlan);
        if (!cancelled && apiPlans.length > 0) {
          setPlans(apiPlans);
        }
      } catch {
        if (!cancelled) {
          setPlans([]);
        }
      }
    };

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live platform counters ("Platforma rəqəmləri") shown right below the hero.
  useEffect(() => {
    let cancelled = false;

    const loadPlatformStats = async () => {
      try {
        const response = await settingsAPI.getPlatformStats();
        if (!cancelled) setPlatformStats(response?.data || null);
      } catch {
        if (!cancelled) setPlatformStats(null);
      }
    };

    loadPlatformStats();
    return () => {
      cancelled = true;
    };
  }, []);

  // On first landing, request public data (IP-based) to suggest default language.
  // Apply only when user has not chosen a language before.
  useEffect(() => {
    let cancelled = false;

    const applySuggestedLanguage = async () => {
      try {
        const existingUserLanguage = localStorage.getItem('userLanguage');
        const geoLanguageApplied = localStorage.getItem('_geoLanguageApplied');

        // Only apply geo suggestion if no user language saved AND we haven't already tried
        if (existingUserLanguage || geoLanguageApplied) return;

        const resp = await partnerAPI.getPublic();
        const suggested = String(resp?.data?.suggestedLanguage || '').trim().toLowerCase();
        const geo = resp?.data?.geo || {};

        // Store the suggestion from backend for debugging
        localStorage.setItem('_geoSuggestedLanguage', suggested);
        localStorage.setItem('_geoCountry', geo.country || '');

        const supported = ['en', 'az', 'ru', 'tr'];
        if (!cancelled && supported.includes(suggested)) {
          await changeLanguage(suggested);
          localStorage.setItem('i18nextLng', suggested);
          localStorage.setItem('userLanguage', suggested);
          localStorage.setItem('_geoLanguageApplied', 'true');
          console.log(`[Landing] Applied geo-suggested language: ${suggested} for country: ${geo.country}`);
        } else {
          // Mark as attempted even if suggestion was invalid, to prevent retries
          localStorage.setItem('_geoLanguageApplied', 'true');
          if (suggested) {
            console.warn(`[Landing] Unsupported geo-suggested language: ${suggested}`);
          }
        }
      } catch (error) {
        console.error('[Landing] Failed to apply geo-suggested language:', error?.message);
        localStorage.setItem('_geoLanguageApplied', 'true');
      }
    };

    applySuggestedLanguage();
    return () => {
      cancelled = true;
    };
  }, [changeLanguage]);

  const planSource = plans.length > 0 ? plans : [];

  const amazonMonitoringVisiblePlans = useMemo(() => {
    return planSource.filter((p) => p.category === 'amazon_monitoring' && p.isActive !== false);
  }, [planSource]);

  const subscriptionVisiblePlans = useMemo(
    () => planSource.filter((p) => p.category === 'subscription' && p.isActive !== false),
    [planSource]
  );

  const analyticsVisiblePlans = useMemo(
    () => planSource.filter((p) => p.category === 'analytics' && p.isActive !== false),
    [planSource]
  );

  const trackingVisiblePlans = useMemo(
    () => planSource.filter((p) => p.category === 'tracking_plans' && p.isActive !== false),
    [planSource]
  );

  const supportVisiblePlans = useMemo(
    () => planSource.filter((p) => p.category === 'support' && p.isActive !== false),
    [planSource]
  );

  // A tracking plan is directly selectable/requestable in the modal exactly like
  // every other category — clicking "Subscribe" auto-selects and locks that same
  // plan, same as Subscription/Analytics/Amazon Monitoring.
  const onSubscribePlan = (plan, includeTracking = false) => {
    setSelectedPlanId(plan?.id || '');
    setPresetIncludeTracking(!!includeTracking);
    setRequestModalOpen(true);
  };

  const onRequestSuccess = () => {
    Swal.fire({
      icon: 'success',
      title: t('common:success'),
      text: 'Your request has been sent. Admin will reach you soon.',
      confirmButtonColor: '#22d3ee',
    });
  };

  // Features bento ("Hər şeyi sizin üçün asanlaşdırırıq"): image cards on a dark brand panel.
  // Panels keep each image's own aspect ratio so screenshots are never cropped or letterboxed.
  // span = width on the 12-col lg grid; horizontal = full-width card with text left, image right.
  const featureBento = [
    { key: 'amazonToEbay', image: '/landing/features/amazon-to-ebay.webp', span: 'lg:col-span-6', href: pathFor('inventoryTracking', activeLang) },
    { key: 'aiFeedback', image: '/landing/features/ai-feedback.webp', span: 'lg:col-span-6' },
    { key: 'trackingListings', image: '/landing/features/tracking-listings.webp', span: 'lg:col-span-6' },
    { key: 'allInOne', image: '/landing/features/all-in-one.webp', span: 'lg:col-span-6', href: pathFor('productResearch', activeLang) },
    { key: 'priceTracking', image: '/landing/features/product-detail.webp', span: 'lg:col-span-12', horizontal: true, href: pathFor('amazonTracking', activeLang) },
  ].map((card) => ({
    ...card,
    title: t(`landing:featuresSection.cards.${card.key}.title`),
    description: t(`landing:featuresSection.cards.${card.key}.description`),
  }));

  const heroStats = [
    { label: t('landing:stats.tracking'), value: t('landing:stats.trackingValue'), icon: Globe2 },
    { label: t('landing:stats.orderTracking'), value: t('landing:stats.orderTrackingValue'), icon: Truck },
    { label: t('landing:stats.analysis'), value: t('landing:stats.analysisValue'), icon: BarChart3 },
    { label: t('landing:stats.ebay'), value: t('landing:stats.ebayValue'), icon: BadgeCheck },
  ];

  const formatStatNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
  };

  const platformStatCards = [
    {
      key: 'productsTracked',
      icon: Package,
      iconBg: 'bg-orange-400/10 border border-orange-500/20',
      iconColor: 'text-orange-600 dark:text-orange-300',
      value: platformStats?.productsTrackedTotal,
      label: t('landing:platformStats.productsTracked', 'Amazon məhsulları'),
      sublabel: t('landing:platformStats.productsTrackedSub', 'Amazon Checker nəzarətində'),
    },
    {
      key: 'trackingCodes',
      icon: Truck,
      iconBg: 'bg-blue-400/10 border border-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-300',
      value: platformStats?.trackingCodesTotal,
      label: t('landing:platformStats.trackingCodes', 'Verilmiş izləmə kodları'),
      sublabel: t('landing:platformStats.trackingCodesSub', 'AutoTrack vasitəsilə'),
    },
    {
      key: 'marketCredits',
      icon: BarChart3,
      iconBg: 'bg-violet-400/10 border border-violet-500/20',
      iconColor: 'text-violet-600 dark:text-violet-300',
      value: platformStats?.marketAnalysisCreditsUsed,
      label: t('landing:platformStats.marketCredits', 'İstifadə edilmiş Analiz krediti'),
      sublabel: t('landing:platformStats.marketCreditsSub', 'Checkila Analysis vasitəsilə'),
    },
    {
      key: 'aiActions',
      icon: Sparkles,
      iconBg: 'bg-pink-400/10 border border-pink-500/20',
      iconColor: 'text-pink-600 dark:text-pink-300',
      value: platformStats?.aiAssistedActionsTotal,
      label: t('landing:platformStats.aiActions', 'Alınmış Süni İntellekt dəstəyi'),
      sublabel: t('landing:platformStats.aiActionsSub', 'Checkila Smart və Dewiso'),
    },
    {
      key: 'managedListings',
      icon: ClipboardList,
      iconBg: 'bg-indigo-400/10 border border-indigo-500/20',
      iconColor: 'text-indigo-600 dark:text-indigo-300',
      value: platformStats?.managedListingsTotal,
      label: t('landing:platformStats.managedListings', 'Total Managed Listings'),
      sublabel: t('landing:platformStats.managedListingsSub', 'Qoşulmuş eBay hesablarında'),
    },
    {
      key: 'managedOrders',
      icon: ShoppingCart,
      iconBg: 'bg-rose-400/10 border border-rose-500/20',
      iconColor: 'text-rose-600 dark:text-rose-300',
      value: platformStats?.managedOrdersTotal,
      label: t('landing:platformStats.managedOrders', 'Total Managed Orders'),
      sublabel: t('landing:platformStats.managedOrdersSub', 'Qoşulmuş eBay hesablarında'),
    },
  ];

  // Pricing tabs: label, intro text, plans and whether "custom plan" is offered.
  const planTabs = [
    { key: 'subscription', label: t('landing:pricing.subscriptionPlans'), description: t('landing:pricing.subscriptionDescription'), plans: subscriptionVisiblePlans, custom: true },
    { key: 'analytics', label: t('landing:pricing.analyticsPlans'), description: t('landing:pricing.analyticsDescription'), plans: analyticsVisiblePlans, custom: true },
    { key: 'amazon_monitoring', label: t('landing:pricing.amazonMonitoringPlans'), description: t('landing:pricing.amazonMonitoringDescription'), plans: amazonMonitoringVisiblePlans, custom: true },
    { key: 'tracking_plans', label: t('landing:pricing.trackingPlans'), description: t('landing:pricing.trackingDescription'), plans: trackingVisiblePlans },
    { key: 'support', label: t('landing:pricing.supportPlans'), description: t('landing:pricing.supportDescription'), plans: supportVisiblePlans },
  ];

  const showcaseCards = [
    {
      key: 'trackingConverter',
      image: imageFor('trackingConverter'),
      title: t('landing:showcase.tracking.title'),
      description: t('landing:showcase.tracking.description'),
      cta: t('landing:showcase.tracking.cta'),
      heading: t('landing:showcase.tracking.heading'),
      headingAccents: t('landing:showcase.tracking.headingAccents', { returnObjects: true }),
    },
    {
      key: 'marketAnalysis',
      image: imageFor('marketAnalysis'),
      title: t('landing:showcase.marketAnalysis.title'),
      description: t('landing:showcase.marketAnalysis.description'),
      cta: t('landing:showcase.marketAnalysis.cta'),
      heading: t('landing:showcase.marketAnalysis.heading'),
      headingAccents: t('landing:showcase.marketAnalysis.headingAccents', { returnObjects: true }),
    },
  ];

  return (
    <div ref={revealRootRef} className="relative min-h-screen overflow-x-clip bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100">
      {/* Gentle float for the hero preview cards (respects reduced motion). */}
      <style>{`@keyframes landingFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.landing-float{animation:landingFloat 6s ease-in-out infinite}.landing-float-delay{animation-delay:-3s}@media (prefers-reduced-motion: reduce){.landing-float{animation:none}}${SCROLL_REVEAL_CSS}`}</style>
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isDark ? 'opacity-70' : 'opacity-40'}`}>
        <div className="absolute -top-24 left-[-8rem] h-96 w-96 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute top-28 right-[-7rem] h-96 w-96 rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            opacity: isDark ? 0.12 : 0.06,
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      <main className="relative z-10">
        {/* ── Floating, sticky navbar ── */}
        <div className="sticky top-3 z-40 px-4 pt-4 md:px-6">
          <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-lg shadow-slate-900/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 dark:shadow-black/30 md:px-4">
            <a href="#top" className="flex shrink-0 items-center gap-2.5">
              <img src="/logo-2.png" alt="Checkila" className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20" />
              <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
            </a>

            <nav className="hidden items-center gap-0.5 text-sm font-medium text-slate-600 dark:text-slate-300 xl:flex">
              {[
                { href: '#features', label: t('landing:navigation.features') },
                { href: '#plans', label: t('landing:navigation.plans') },
                { href: '/ebay-calculator', label: t('common:nav.ebayCalculator') },
                { to: pathFor('ebayFeeCalculator', activeLang), label: t('seoPages:ebayFeeCalculator.hero.eyebrow') },
                { href: '#contact', label: t('landing:navigation.contact') },
              ].map((item) =>
                item.to ? (
                  <Link key={item.label} to={item.to} className="whitespace-nowrap rounded-full px-2.5 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.label} href={item.href} className="whitespace-nowrap rounded-full px-2.5 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                    {item.label}
                  </a>
                )
              )}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1 md:flex">
                <a
                  href={CHROME_EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('landing:navigation.chromeExtension')}
                  aria-label={t('landing:navigation.chromeExtension')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Puzzle size={16} />
                </a>
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('landing:navigation.telegramBot')}
                  aria-label={t('landing:navigation.telegramBot')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Send size={16} />
                </a>
              </div>
              <LanguageSelector />
              <Link
                to="/login"
                className="hidden items-center whitespace-nowrap rounded-full border border-cyan-500/60 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-400/50 dark:text-cyan-200 dark:hover:bg-cyan-400/10 sm:inline-flex"
              >
                {t('common:auth.login')}
              </Link>
              <Link
                to="/login"
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:shadow-lg hover:shadow-cyan-500/30 md:inline-flex"
              >
                {t('landing:hero.cta')}
                <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-expanded={mobileMenuOpen}
                aria-label={t('landing:hero.menu', 'Menyu')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 xl:hidden"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95 xl:hidden">
              <nav className="flex flex-col text-sm font-medium text-slate-700 dark:text-slate-200">
                {[
                  { href: '#features', label: t('landing:navigation.features') },
                  { href: '#plans', label: t('landing:navigation.plans') },
                  { href: '/ebay-calculator', label: t('common:nav.ebayCalculator') },
                  { to: pathFor('ebayFeeCalculator', activeLang), label: t('seoPages:ebayFeeCalculator.hero.eyebrow') },
                  { href: '#contact', label: t('landing:navigation.contact') },
                ].map((item) =>
                  item.to ? (
                    <Link key={item.label} to={item.to} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-white/10">
                      {item.label}
                    </Link>
                  ) : (
                    <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-white/10">
                      {item.label}
                    </a>
                  )
                )}
              </nav>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                <Link to="/login" className="inline-flex items-center justify-center rounded-full border border-cyan-500/60 px-4 py-2.5 text-sm font-semibold text-cyan-700 dark:text-cyan-200">
                  {t('common:auth.login')}
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                  {t('landing:hero.cta')} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Hero ── */}
        <section id="top" className="relative overflow-hidden px-6 pb-16 pt-14 md:pb-24 md:pt-20">
          {/* Soft flowing lines */}
          <svg
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] w-full text-cyan-500/[0.12] dark:text-cyan-300/[0.08]"
            viewBox="0 0 1440 520"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <path
                key={i}
                d={`M-40 ${70 + i * 22} C 360 ${10 + i * 26}, 720 ${200 + i * 14}, 1480 ${40 + i * 24}`}
                stroke="currentColor"
                strokeWidth="1.2"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute left-1/2 top-40 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/20 via-blue-500/15 to-indigo-500/10 blur-3xl dark:from-cyan-400/15 dark:via-blue-500/10" aria-hidden="true" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div data-reveal className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
              <Sparkles size={14} />
              {t('landing:hero.eyebrow')}
            </div>

            <h1 data-reveal data-reveal-delay="100" className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl" style={{ textWrap: "balance" }}>
              {renderAccentedTitle(t('landing:hero.title'), t('landing:hero.titleAccents', { returnObjects: true }))}
            </h1>

            <p data-reveal data-reveal-delay="200" className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-slate-800 dark:text-slate-100 md:text-xl">
              {t('landing:hero.tagline')}
            </p>
            <p data-reveal data-reveal-delay="260" className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
              {t('landing:hero.subtitle')}
            </p>

            <div data-reveal data-reveal-delay="340" className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/35"
              >
                {t('landing:hero.cta')}
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#plans"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white/70 px-7 py-3.5 text-base font-semibold text-slate-800 backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                {t('landing:hero.viewPlans')}
              </a>
            </div>

            {/* Key capabilities */}
            <div data-reveal-stagger="zoom" className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {heroStats.map((stat) => (
                <span
                  key={stat.label}
                  title={stat.label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  <stat.icon className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                  {stat.value}
                </span>
              ))}
            </div>

            {/* Integrations */}
            <div data-reveal="fade" data-reveal-delay="500" className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{t('landing:hero.integrations', 'İnteqrasiyalar')}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0">
                <span className="text-3xl font-bold tracking-tight" aria-label="eBay">
                  <span className="text-[#E53238]">e</span>
                  <span className="text-[#0064D2]">b</span>
                  <span className="text-[#F5AF02]">a</span>
                  <span className="text-[#86B817]">y</span>
                </span>
                <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">amazon</span>
                <span className="inline-flex items-center gap-1.5 text-lg font-semibold text-[#229ED9]">
                  <Send size={18} /> Telegram
                </span>
                <span className="inline-flex items-center gap-1.5 text-lg font-semibold text-slate-700 dark:text-slate-200">
                  <Puzzle size={18} className="text-[#4285F4]" /> Chrome
                </span>
              </div>
            </div>
          </div>

          {/* Product preview */}
          <div data-reveal="zoom" data-reveal-delay="250" className="relative mx-auto mt-14 max-w-6xl md:mt-16">
            <div className="absolute -inset-x-6 -bottom-6 top-10 rounded-[2.5rem] bg-gradient-to-b from-cyan-400/25 via-blue-500/15 to-transparent blur-2xl dark:from-cyan-400/15" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/50 md:rounded-3xl">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-white/10 dark:bg-slate-800/60">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="mx-auto hidden rounded-md bg-white px-3 py-0.5 text-xs text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10 sm:block">checkila.com</span>
              </div>
              <img
                src="/landing/hero-dashboard.png"
                onError={(e) => {
                  if (!e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = '1';
                    e.currentTarget.src = '/analytic-1.png';
                  }
                }}
                alt="Checkila dashboard"
                className="block w-full"
              />
            </div>

            {/* Floating cards */}
            <div className="landing-float absolute -left-4 top-16 hidden w-64 rounded-2xl border border-slate-200 bg-white/95 p-3.5 text-left shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95 md:block xl:-left-14">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                  <ShoppingCart size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('landing:hero.floatOrderTitle', 'Yeni sifariş')}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('landing:hero.floatOrderText')}</p>
                </div>
              </div>
            </div>
            <div className="landing-float landing-float-delay absolute -right-4 top-1/3 hidden w-64 rounded-2xl border border-slate-200 bg-white/95 p-3.5 text-left shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95 md:block xl:-right-14">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Truck size={18} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {t('landing:hero.floatTrackingTitle', 'Tracking yükləndi')} <CheckCircle2 size={14} className="text-emerald-500" />
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('landing:hero.floatTrackingText')}</p>
                </div>
              </div>
            </div>
            <div className="landing-float absolute -bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95 sm:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                <BarChart3 size={18} />
              </span>
              <div className="text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('landing:hero.floatProfitTitle', 'Bu ay mənfəət')}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+$2,480.50</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Platform numbers ── */}
        <section className="relative px-6 pb-20 pt-6 md:pb-28">
          <div className="pointer-events-none absolute left-1/2 top-24 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/15 via-blue-500/10 to-violet-500/10 blur-3xl dark:from-cyan-400/10" aria-hidden="true" />

          <div className="relative mx-auto max-w-6xl">
            <div data-reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-sm backdrop-blur dark:border-emerald-300/25 dark:bg-white/5 dark:text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t('landing:platformStats.live', 'Canlı məlumat')}
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl" style={{ textWrap: 'balance' }}>
                {renderAccentedTitle(t('landing:platformStats.title', 'Platforma rəqəmləri'), t('landing:platformStats.titleAccents', { returnObjects: true }))}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:platformStats.subtitle', 'Hamısı bazadan, canlı')}</p>
            </div>

            <div data-reveal-stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {platformStatCards.map((stat) => {
                const glow = STAT_GLOW[stat.key] || '#06b6d4';
                return (
                  <article
                    key={stat.key}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30"
                  >
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.14] blur-2xl transition duration-300 group-hover:opacity-30"
                      style={{ background: glow }}
                      aria-hidden="true"
                    />
                    <span className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </span>
                    <p className="relative mt-4 text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
                      {platformStats ? <AnimatedNumber value={stat.value} /> : '—'}
                    </p>
                    <p className="relative mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{stat.label}</p>
                    <p className="relative mt-0.5 text-xs text-slate-500 dark:text-slate-400">{stat.sublabel}</p>
                  </article>
                );
              })}

              {/* Reviews: average rating with stars + positive / negative split */}
              <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400 opacity-[0.16] blur-2xl transition duration-300 group-hover:opacity-30" aria-hidden="true" />
                <div className="relative flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-5 w-5 ${
                        Number(platformStats?.reviewsAvgRating || 0) >= n - 0.25
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <p className="relative mt-4 text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
                  {platformStats ? Number(platformStats.reviewsAvgRating || 0).toFixed(1) : '—'}
                  <span className="ml-1 text-base font-semibold text-slate-400">/ 5</span>
                </p>
                <p className="relative mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{t('landing:platformStats.reviews', 'İstifadəçi rəyləri')}</p>
                <p className="relative mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {platformStats
                    ? t('landing:platformStats.reviewsSummary', {
                        positive: formatStatNumber(platformStats.reviewsPositiveCount),
                        negative: formatStatNumber(platformStats.reviewsNegativeCount),
                        defaultValue: '{{positive}} pozitiv · {{negative}} neqativ',
                      })
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setReviewsModalOpen(true)}
                  className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 transition hover:gap-1.5 dark:text-cyan-300"
                >
                  {t('landing:platformStats.seeReviews', 'Rəylərə bax')} <ArrowRight size={12} />
                </button>
              </article>

              {/* Teaser tile (the seller count is intentionally not public) */}
              <article className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-5 text-center dark:border-white/15 dark:from-white/[0.03] dark:to-transparent">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10">
                  <EyeOff className="h-5 w-5" />
                </span>
                <p className="mt-3 max-w-[12rem] text-sm font-medium italic leading-5 text-slate-600 dark:text-slate-300">
                  {t('landing:platformStats.mysteryBoxText', 'Həqiqət rəqəmlərdə gizlidir')}
                </p>
              </article>
            </div>
          </div>
        </section>

        <PartnersSection />

        {/* ── Features bento ── */}
        <section id="features" className="relative px-4 pb-20 sm:px-6 md:pb-28">
          <div data-reveal="zoom" className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] px-5 py-12 shadow-2xl shadow-slate-900/20 ring-1 ring-white/10 sm:px-8 md:rounded-[2.5rem] md:px-12 md:py-16">
            <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[520px] rounded-full bg-blue-600/25 blur-3xl" aria-hidden="true" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
              }}
              aria-hidden="true"
            />

            <div data-reveal data-reveal-delay="150" className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 backdrop-blur">
                  <Sparkles size={14} />
                  {t('landing:featuresSection.eyebrow')}
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl" style={{ textWrap: 'balance' }}>
                  {renderAccentedTitle(
                    t('landing:featuresSection.bentoTitle'),
                    t('landing:featuresSection.bentoTitleAccents', { returnObjects: true })
                  )}
                </h2>
              </div>
              <p className="text-base leading-7 text-slate-300 md:text-lg lg:pb-1">{t('landing:featuresSection.bentoDescription')}</p>
            </div>

            <div data-reveal-stagger className="relative mt-10 grid grid-cols-1 gap-4 md:mt-12 lg:grid-cols-12 lg:gap-5">
              {featureBento.map((card) => (
                <article
                  key={card.key}
                  className={`group flex flex-col rounded-3xl border border-white/10 bg-white/[0.05] p-2.5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-cyan-950/40 ${card.span} ${
                    card.horizontal ? 'lg:flex-row lg:items-stretch' : ''
                  }`}
                >
                  <div
                    className={`relative overflow-hidden rounded-[1.25rem] bg-white ${
                      card.horizontal ? 'aspect-[1807/727] lg:order-2 lg:w-[62%] lg:shrink-0 lg:self-center' : 'aspect-[1672/941]'
                    }`}
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className={`flex flex-1 flex-col px-3 pb-3 pt-4 ${card.horizontal ? 'lg:justify-center lg:px-7 lg:py-6' : ''}`}>
                    <h3 className={`font-semibold tracking-tight text-white ${card.horizontal ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300 md:text-[15px]">{card.description}</p>
                    {card.href && (
                      <Link
                        to={card.href}
                        className="mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-cyan-300 transition hover:gap-2 hover:text-cyan-200"
                      >
                        {t('landing:featuresSection.learnMore')}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Showcase: alternating illustration + text rows ── */}
        <section id="showcase" className="relative px-6 pb-20 md:pb-28">
          <div className="pointer-events-none absolute left-1/2 top-40 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl">
            <div data-reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
                <Sparkles size={14} />
                {t('landing:showcase.eyebrow')}
              </span>
            </div>

            <div className="mt-12 space-y-20 md:space-y-28">
              {showcaseCards.map((card, idx) => {
                const Mock = card.key === 'trackingConverter' ? TrackingMock : MarketAnalysisMock;
                const reversed = idx % 2 === 1;
                return (
                  <div key={card.key} className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
                    <div data-reveal={reversed ? 'right' : 'left'} className={reversed ? 'lg:order-2' : ''}>
                      <Mock />
                    </div>
                    <div data-reveal={reversed ? 'left' : 'right'} data-reveal-delay="120" className={reversed ? 'lg:order-1' : ''}>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">{card.title}</p>
                      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-[2.75rem] md:leading-[1.15]" style={{ textWrap: 'balance' }}>
                        {renderAccentedTitle(card.heading, card.headingAccents)}
                      </h2>
                      <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{card.description}</p>
                      <Link
                        to={pathFor(card.key, activeLang)}
                        className="group mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30"
                      >
                        {card.cta}
                        <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <AppsSection apkUrl={MOBILE_APK_URL} chromeUrl={CHROME_EXTENSION_URL} telegramUrl={TELEGRAM_BOT_URL} />

        {/* ── Plans ── */}
        <section id="plans" className="relative px-6 pb-20 md:pb-28">
          <div className="pointer-events-none absolute left-1/2 top-24 h-[360px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/15 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-7xl">
            <div data-reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
                <BadgeCheck size={14} />
                {t('landing:pricing.eyebrow')}
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl" style={{ textWrap: 'balance' }}>
                {renderAccentedTitle(t('landing:pricing.title'), t('landing:pricing.titleAccents', { returnObjects: true }))}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:pricing.description')}</p>
            </div>

            {/* Tabs: scroll sideways on small screens instead of wrapping */}
            <div data-reveal data-reveal-delay="100" className="mt-10 flex justify-center">
              <div className="max-w-full overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
                  {planTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition md:px-5 ${
                        activeTab === tab.key
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {planTabs
              .filter((tab) => tab.key === activeTab)
              .map((tab) => (
                <div key={tab.key} className="mt-10">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{tab.description}</p>
                    {tab.custom && (
                      <button
                        type="button"
                        onClick={() => onSubscribePlan({ id: 'custom' })}
                        className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-cyan-500/30 bg-white/80 px-4 py-2 text-sm font-semibold text-cyan-700 shadow-sm transition hover:border-transparent hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 hover:text-white dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200"
                      >
                        <Sparkles size={14} />
                        {t('landing:pricing.requestCustom')}
                      </button>
                    )}
                  </div>

                  <div data-reveal-stagger className={`mt-8 grid gap-5 ${tab.key === 'analytics' ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
                    {tab.plans.length === 0 ? (
                      <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-300">
                        <p>{t('landing:pricing.noPlans')}</p>
                        <a
                          href="mailto:checkilanotify@gmail.com"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                        >
                          {t('landing:pricing.noPlansCta')}
                          <ArrowRight size={14} />
                        </a>
                      </div>
                    ) : (
                      tab.plans.map((plan) => <PlanCard key={plan.id || plan.name} plan={plan} onSubscribe={onSubscribePlan} />)
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* ── FAQ: sticky intro + accordion (answers stay in the DOM for SEO) ── */}
        <section id="faq" className="relative px-6 pb-20 md:pb-28">
          <div className="pointer-events-none absolute left-0 top-20 h-[320px] w-[520px] rounded-full bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div data-reveal="left" className="lg:sticky lg:top-28 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
                <Sparkles size={14} />
                {t('landing:faq.eyebrow')}
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl md:leading-[1.1]" style={{ textWrap: 'balance' }}>
                {renderAccentedTitle(t('landing:faq.title'), t('landing:faq.titleAccents', { returnObjects: true }))}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:faq.description')}</p>

              <div className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] p-6 text-white shadow-xl shadow-slate-900/20 ring-1 ring-white/10">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden="true" />
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                  <Mail className="h-5 w-5" />
                </span>
                <p className="relative mt-4 text-lg font-semibold">{t('landing:faq.stillQuestions')}</p>
                <p className="relative mt-1 text-sm leading-6 text-slate-300">{t('landing:faq.stillQuestionsText')}</p>
                <a
                  href="#contact"
                  className="group relative mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50"
                >
                  {t('landing:faq.contactUs')}
                  <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>

            <div data-reveal-stagger className="space-y-3">
              {faqItems.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={item.question}
                    className={`rounded-2xl border transition duration-300 ${
                      isOpen
                        ? 'border-cyan-500/30 bg-white shadow-lg shadow-cyan-900/[0.06] dark:border-cyan-300/25 dark:bg-white/[0.06]'
                        : 'border-slate-200/80 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-6 md:py-5"
                      >
                        <span className={`text-base font-semibold md:text-[17px] ${isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                          {item.question}
                        </span>
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 ${
                            isOpen
                              ? 'rotate-180 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                              : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                          }`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </span>
                      </button>
                    </h3>
                    <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm leading-7 text-slate-600 dark:text-slate-300 md:px-6 md:text-[15px]">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <CtaCarouselSection />

      </main>

      <footer className="relative z-10 border-t border-slate-200 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.05fr_0.75fr_0.85fr]">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/logo-2.png"
                  alt="Checkila"
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20"
                />
                <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
                {t('landing:footer.tagline')}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">
                {t('landing:footer.resourcesTitle')}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {SEO_PAGES.map((page) => (
                  <li key={page.key}>
                    <Link
                      to={pathFor(page.key, activeLang)}
                      className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      {t(`seoPages:${page.key}.hero.eyebrow`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">
                {t('landing:footer.contactTitle')}
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                    <Phone size={15} />
                  </span>
                  <a
                    href="tel:+994708047546"
                    className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    +994 70 804 75 46
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                    <Mail size={15} />
                  </span>
                  <a
                    href="mailto:checkilanotify@gmail.com"
                    className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    checkilanotify@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                    <BadgeCheck size={15} />
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{t('landing:footer.taxId')}: 1807480082</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                    <MapPin size={15} />
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {t('landing:footer.address')}
                  </span>
                </li>
              </ul>
              {/* Trust badges: MilliNet participant + Epoint merchant widget */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <MilliNetBadge />
                <div className={TRUST_BADGE_CARD}>
                  <iframe
                    src="https://epoint.az/az/widget?id=14131&type=users"
                    title="Epoint"
                    width="180"
                    height="90"
                    frameBorder="0"
                    scrolling="no"
                    allowTransparency="true"
                    loading="lazy"
                    className="block"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} Checkila. {t('landing:footer.rights')}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/privacy" className="transition hover:text-slate-900 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link to="/extension-privacy" className="transition hover:text-slate-900 dark:hover:text-white">
                Extension Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <SubscriptionRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        plans={planSource}
        selectedPlanId={selectedPlanId}
        lockPlan={true}
        presetIncludeTracking={presetIncludeTracking}
        onSuccess={onRequestSuccess}
      />

      <ReviewsModal open={reviewsModalOpen} onClose={() => setReviewsModalOpen(false)} isDark={isDark} />
    </div>
  );
}
