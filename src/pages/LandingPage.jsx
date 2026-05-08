import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Globe2,
  Radar,
  ShieldCheck,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { partnerAPI, settingsAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import PartnersSection from '../components/PartnersSection';

function SectionHeader({ eyebrow, title, description, align = 'left' }) {
  const alignClasses = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`flex flex-col gap-3 ${alignClasses}`}>
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
        {eyebrow}
      </div>
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">{title}</h2>
      <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{description}</p>
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
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/15"
      >
        <Globe2 size={16} />
        <span className="hidden sm:inline">{currentLangLabel.split(' ')[0]}</span>
        <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/15 bg-slate-900 shadow-xl z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left text-sm font-medium transition ${
                currentLanguage === lang.code
                  ? 'bg-cyan-500/20 text-cyan-100'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
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

function PlanCard({ plan, onSubscribe }) {
  const { formatPrice } = useLanguage();
  const { t } = useTranslation('pricing');

  const featuredClasses = plan.featured
    ? 'border-cyan-300/50 bg-slate-900/95 shadow-[0_20px_80px_rgba(34,211,238,0.14)]'
    : 'border-white/10 bg-slate-900/70';

  const hasDiscount =
    Number.isFinite(Number(plan.actualPrice)) &&
    Number.isFinite(Number(plan.discountedPrice)) &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);

  const discountPercent = hasDiscount
    ? Math.round(((Number(plan.actualPrice) - Number(plan.discountedPrice)) / Number(plan.actualPrice)) * 100)
    : 0;

  // Convert price from AZN to target currency
  const displayPrice = plan.actualPrice
    ? formatPrice(plan.actualPrice)
    : formatPrice(plan.price?.match(/[\d.]+/)?.[0] || 0);
  const discountedDisplay = plan.discountedPrice ? formatPrice(plan.discountedPrice) : null;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-5 shadow-lg backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 ${featuredClasses}`}
      style={{ animation: 'fadeIn 0.4s ease both' }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${plan.accent} opacity-100`} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{plan.duration}</p>
          </div>
          {plan.featured ? (
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {t('planCard.featured')}
            </span>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-3">
          {hasDiscount && discountedDisplay ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300 line-through">{displayPrice}</p>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  {t('pricing:planCard.save', { percent: discountPercent })}
                </span>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-semibold tracking-tight text-white">{discountedDisplay}</span>
                <span className="text-xs text-slate-400">{t('pricing:planCard.specialOffer')}</span>
              </div>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-white">{displayPrice}</span>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-[3rem] text-sm leading-6 text-slate-300">{plan.summary}</p>

        <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-200">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onSubscribe?.(plan)}
          className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          {t('planCard.subscribe')}
        </button>
      </div>
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
    category:
      normalizedCategory === 'analytics' || normalizedCategory === 'analysis' || normalizedCategory === 'data_analytics'
        ? 'analytics'
        : normalizedCategory === 'amazon_monitoring' || normalizedCategory === 'amazonmonitoring'
        ? 'amazon_monitoring'
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
  const { t } = useTranslation(['landing', 'common', 'pricing']);
  const { changeLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('subscription');
  const [plans, setPlans] = useState([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');

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

  const onSubscribePlan = (plan) => {
    setSelectedPlanId(plan?.id || '');
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

  // Build dynamic feature cards from translations
  const featureCards = [
    {
      icon: BarChart3,
      title: t('landing:features.tracking.title'),
      description: t('landing:features.tracking.description'),
    },
    {
      icon: Radar,
      title: t('landing:features.analysis.title'),
      description: t('landing:features.analysis.description'),
    },
    {
      icon: ShieldCheck,
      title: t('landing:features.listing.title'),
      description: t('landing:features.listing.description'),
    },
  ];

  const heroStats = [
    { label: t('landing:stats.tracking'), value: t('landing:stats.trackingValue'), icon: Globe2 },
    { label: t('landing:stats.analysis'), value: t('landing:stats.analysisValue'), icon: BarChart3 },
    { label: t('landing:stats.ebay'), value: t('landing:stats.ebayValue'), icon: BadgeCheck },
  ];

  const workflowSteps = [
    {
      title: t('landing:workflow.discover.title'),
      description: t('landing:workflow.discover.description'),
    },
    {
      title: t('landing:workflow.decide.title'),
      description: t('landing:workflow.decide.description'),
    },
    {
      title: t('landing:workflow.publish.title'),
      description: t('landing:workflow.publish.description'),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-24 left-[-8rem] h-96 w-96 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute top-28 right-[-7rem] h-96 w-96 rounded-full bg-blue-500/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-18 pt-8 md:pb-24 md:pt-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo-2.png"
                alt="Checkila"
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/20"
              />
              <span className="text-2xl font-semibold tracking-tight">Checkila</span>
            </div>
            <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#features" className="transition hover:text-white">
                {t('landing:navigation.features')}
              </a>
              <a href="#plans" className="transition hover:text-white">
                {t('landing:navigation.plans')}
              </a>
              <a href="/ebay-calculator" className="transition hover:text-white">
                {t('common:ebayCalculator')}
              </a>
              <a href="#contact" className="transition hover:text-white">
                {t('landing:navigation.contact')}
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <LanguageSelector />
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/15"
              >
                {t('common:auth.login')}
                <ArrowRight size={14} />
              </Link>
            </div>
          </header>

          <div className="mt-14 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles size={14} />
                {t('landing:hero.eyebrow')}
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl xl:text-7xl">
                {t('landing:hero.title')}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
                {t('landing:hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400"
                >
                  {t('landing:hero.cta')}
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
                >
                  {t('landing:hero.viewPlans')}
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <article key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                    <stat.icon className="h-5 w-5 text-cyan-300" />
                    <p className="mt-3 text-sm font-medium text-white">{stat.value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{stat.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-transparent blur-2xl" />
              <div className="relative rounded-[2rem] border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-5">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/60">
                  <img
                    src="/analytic.jpg"
                    alt="Checkila Analysis preview"
                    className="h-full min-h-[28rem] w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <PartnersSection />

        <section id="features" className="mx-auto max-w-7xl px-6 pb-20 md:pb-28">
          <SectionHeader
            eyebrow={t('landing:hero.eyebrow')}
            title={t('landing:features.tracking.title')}
            description={t('landing:features.tracking.description')}
            align="center"
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {featureCards.map((feature, idx) => (
              <article
                key={feature.title}
                className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-lg backdrop-blur"
                style={{ animation: `fadeIn 0.35s ease ${idx * 0.08}s both` }}
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
                  <feature.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-xl shadow-black/25 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('landing:workflowSection.eyebrow')}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {t('landing:workflowSection.title')}
              </h3>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {workflowSteps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15 text-xs text-cyan-100">
                        0{index + 1}
                      </span>
                      {step.title}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 p-6 shadow-xl shadow-black/20 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">{t('landing:workflowSection.operationalClarity')}</p>
              <ul className="mt-5 space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{t('landing:workflowSection.clarity1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{t('landing:workflowSection.clarity2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{t('landing:workflowSection.clarity3')}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-7xl px-6 pb-20 md:pb-28">
          <SectionHeader
            eyebrow={t('landing:pricing.eyebrow')}
            title={t('landing:pricing.title')}
            description={t('landing:pricing.description')}
            align="center"
          />

          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] p-1.5 backdrop-blur">
              <button
                onClick={() => setActiveTab('subscription')}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === 'subscription'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('landing:pricing.subscriptionPlans')}
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('landing:pricing.analyticsPlans')}
              </button>
              <button
                onClick={() => setActiveTab('amazon_monitoring')}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === 'amazon_monitoring'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t('landing:pricing.amazonMonitoringPlans')}
              </button>
            </div>
          </div>

          <div className="mt-12">
            {activeTab === 'subscription' && (
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
                      {t('landing:pricing.subscriptionPlans')}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      {t('landing:pricing.subscriptionDescription')}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => onSubscribePlan({ id: 'custom' })}
                    className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {t('landing:pricing.requestCustom')}
                  </button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
                  {subscriptionVisiblePlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">
                      {t('landing:pricing.noPlans')}
                    </div>
                  ) : (
                    subscriptionVisiblePlans.map((plan) => (
                      <PlanCard key={plan.id || plan.name} plan={plan} onSubscribe={onSubscribePlan} />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
                      {t('landing:pricing.analyticsPlans')}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      {t('landing:pricing.analyticsDescription')}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => onSubscribePlan({ id: 'custom' })}
                    className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {t('landing:pricing.requestCustom')}
                  </button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {analyticsVisiblePlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">
                      {t('landing:pricing.noPlans')}
                    </div>
                  ) : (
                    analyticsVisiblePlans.map((plan) => (
                      <PlanCard key={plan.id || plan.name} plan={plan} onSubscribe={onSubscribePlan} />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'amazon_monitoring' && (
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
                      {t('landing:pricing.amazonMonitoringPlans')}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      {t('landing:pricing.amazonMonitoringDescription')}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => onSubscribePlan({ id: 'custom' })}
                    className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {t('landing:pricing.requestCustom')}
                  </button>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
                  {amazonMonitoringVisiblePlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">
                      {t('landing:pricing.noPlans')}
                    </div>
                  ) : (
                    amazonMonitoringVisiblePlans.map((plan) => (
                      <PlanCard key={plan.id || plan.name} plan={plan} onSubscribe={onSubscribePlan} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-6 pb-16 md:pb-24">
          <div className="grid gap-4 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/75 p-6 shadow-2xl shadow-black/25 backdrop-blur lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">{t('landing:cta.needHelp')}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
                {t('landing:cta.startWithPlan')}
              </h3>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div>
                <p className="text-sm font-medium text-slate-200">{t('landing:cta.ready')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {t('landing:cta.readyDescription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]"
                >
                  {t('landing:cta.ctaButton')}
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
                >
                  {t('landing:cta.reviewPlans')}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SubscriptionRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        plans={planSource}
        selectedPlanId={selectedPlanId}
        lockPlan={true}
        onSuccess={onRequestSuccess}
      />
    </div>
  );
}
