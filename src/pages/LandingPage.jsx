import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock3,
  Globe2,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { settingsAPI } from '../services/api';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';

const featureCards = [
  {
    icon: BarChart3,
    title: 'Tracking that stays current',
    description: 'Monitor Amazon pricing, inventory signals, and movement with fewer manual checks.',
  },
  {
    icon: Radar,
    title: 'Market analysis built in',
    description: 'Use credits on fast market analysis workflows to validate opportunities before listing.',
  },
  {
    icon: ShieldCheck,
    title: 'Listing control and support',
    description: 'Keep every draft editable, organized, and supported by responsive service coverage.',
  },
];

const heroStats = [
  { label: 'Amazon price tracking', value: 'Track products faster', icon: Globe2 },
  { label: 'Market analysis', value: 'Credit-based intelligence', icon: BarChart3 },
  { label: 'eBay account workflow', value: 'Built for multi-account use', icon: BadgeCheck },
];

const workflowSteps = [
  {
    title: 'Discover',
    description: 'Start from Amazon lookup, market analysis, or a product you already track.',
  },
  {
    title: 'Decide',
    description: 'Compare pricing, credits, and account limits before you commit to a plan.',
  },
  {
    title: 'Publish',
    description: 'Move into your eBay workflow with a clear structure and fewer surprises.',
  },
];

const umimiPlans = [
  {
    name: 'Trial Plan',
    duration: '1 Week',
    price: '2 AZN',
    summary: 'A short starter plan for checking core workflows.',
    features: ['Track up to 3 Amazon products', '1 Amazon lookup (total)', '100 credits for Market Analysis', 'Connect 1 eBay account'],
    accent: 'from-cyan-400/25 to-blue-500/15',
    featured: false,
  },
  {
    name: 'Basic Plan',
    duration: 'Monthly',
    price: '12.99 AZN',
    summary: 'A practical plan for small sellers who need steady tracking.',
    features: ['Track up to 20 Amazon products', '1 Amazon lookup per day', '500 credits for Market Analysis', 'Connect 1 eBay account', '24/7 Support'],
    accent: 'from-sky-400/25 to-indigo-500/15',
    featured: false,
  },
  {
    name: 'Pro Plan',
    duration: 'Monthly',
    price: '23.99 AZN',
    summary: 'A stronger plan for growing operations with heavier usage.',
    features: ['Track up to 50 Amazon products', '2 Amazon lookups per day', '1,000 credits for Market Analysis', 'Connect up to 5 eBay accounts', '24/7 Support'],
    accent: 'from-cyan-400/35 to-blue-500/20',
    featured: true,
  },
  {
    name: 'Advantage Plan',
    duration: 'Monthly',
    price: '37.99 AZN',
    summary: 'The highest-usage package for active teams and scaling sellers.',
    features: ['Track up to 100 Amazon products', '3 Amazon lookups per day', '2,000 credits for Market Analysis', 'Connect up to 10 eBay accounts', '24/7 Support'],
    accent: 'from-amber-400/25 to-orange-500/15',
    featured: false,
  },
];

const analyticsPlans = [
  {
    name: 'Basic Analytics Plan',
    duration: 'Monthly',
    price: '7.99 AZN',
    summary: 'Best for focused analysis use without a large feature set.',
    features: ['2,000 credits for Market Analysis'],
    accent: 'from-violet-400/20 to-slate-700/10',
    featured: false,
  },
  {
    name: 'Pro Analytics Plan',
    duration: 'Monthly',
    price: '9.90 AZN',
    summary: 'A better fit for frequent analysis and conversion workflows.',
    features: ['5,000 credits for Market Analysis', 'Access to Sell Similar feature'],
    accent: 'from-cyan-400/30 to-blue-500/15',
    featured: true,
  },
];

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

function PlanCard({ plan, onSubscribe }) {
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

  const currency = plan.currency || 'AZN';

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border p-5 shadow-lg backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 ${featuredClasses}`}
      style={{ animation: 'fadeIn 0.4s ease both' }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${plan.accent} opacity-100`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{plan.duration}</p>
          </div>
          {plan.featured ? (
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Best value
            </span>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-3">
          {hasDiscount ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300 line-through">
                  {Number(plan.actualPrice).toFixed(2)} {currency}
                </p>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  Save {discountPercent}%
                </span>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-semibold tracking-tight text-white">
                  {Number(plan.discountedPrice).toFixed(2)} {currency}
                </span>
                <span className="text-xs text-slate-400">special offer</span>
              </div>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-white">{plan.price}</span>
            </div>
          )}
        </div>

        <p className="mt-3 min-h-[3rem] text-sm leading-6 text-slate-300">{plan.summary}</p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
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
          Subscribe
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

  return {
    id: raw.id || fallbackId,
    name: raw.name || 'Plan',
    duration: raw.duration || '',
    price: raw.price || '',
    actualPrice: raw.actualPrice ?? null,
    discountedPrice: raw.discountedPrice ?? null,
    currency: raw.currency || 'AZN',
    summary: raw.description || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    category: raw.category === 'analytics' ? 'analytics' : 'subscription',
    featured: !!raw.featured,
    isActive: raw.isActive !== false,
    accent:
      raw.category === 'analytics'
        ? 'from-violet-400/20 to-slate-700/10'
        : raw.featured
        ? 'from-cyan-400/35 to-blue-500/20'
        : 'from-sky-400/25 to-indigo-500/15',
  };
}

export default function LandingPage() {
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

  const planSource = plans;

  const subscriptionPlans = useMemo(
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
      title: 'Request Received',
      text: 'Your request has been sent. Admin will reach you soon.',
      confirmButtonColor: '#22d3ee',
    });
  };

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
                Features
              </a>
              <a href="#plans" className="transition hover:text-white">
                Plans
              </a>
              <a href="#contact" className="transition hover:text-white">
                Contact
              </a>
            </nav>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/15"
            >
              Portal
              <ArrowRight size={14} />
            </Link>
          </header>

          <div className="mt-14 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles size={14} />
                Way to e-commerce
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl xl:text-7xl">
                Your dependable guide to smarter pricing, tracking, and selling.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
                Checkila helps sellers automate product tracking, validate market opportunities, and manage
                eBay workflows with a polished experience that feels fast, clear, and premium.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400"
                >
                  Enter Portal
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
                >
                  View plans
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
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Visual preview</p>
                    <p className="mt-2 text-sm text-slate-300">Swap these panels with your own screenshots or promo imagery.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    <Star size={14} />
                    Premium layout
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.75rem] border border-dashed border-cyan-300/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5">
                    <div className="flex h-full min-h-[17rem] flex-col justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                        <span>Homepage image slot</span>
                        <Clock3 className="h-4 w-4 text-cyan-300" />
                      </div>
                      <div className="space-y-3">
                        <p className="text-2xl font-semibold text-white">Insert a dashboard or product screenshot here</p>
                        <p className="max-w-sm text-sm leading-6 text-slate-300">
                          This panel is intentionally framed so your own media can drop in later without changing
                          the overall composition.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product visual</p>
                      <div className="mt-3 flex min-h-[7.5rem] items-center justify-center rounded-[1.1rem] border border-dashed border-white/15 bg-slate-950/60 text-center text-sm text-slate-400">
                        Replace with a product shot or app mockup
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Trust marker</p>
                      <p className="mt-3 text-lg font-semibold text-white">Clear plans, clear usage, clear upgrades.</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Show pricing, credits, and support in one place so buyers understand the value fast.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 pb-20 md:pb-28">
          <SectionHeader
            eyebrow="What you get"
            title="Everything is shaped around faster decisions and cleaner execution."
            description="The layout is intentionally concise: high-value features, measurable limits, and a premium visual rhythm that makes the product feel established from the first screen."
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
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workflow shape</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                A clean sequence for discovery, comparison, and launch.
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
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Operational clarity</p>
              <ul className="mt-5 space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>Keep tracking counts and daily lookups visible from the first screen.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>Use a premium plan grid to make upgrades feel simple, not crowded.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>Keep the page flexible so your own images and future sections can slot in cleanly.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-7xl px-6 pb-20 md:pb-28">
          <SectionHeader
            eyebrow="Our plans"
            title="Flexible packages for tracking, analysis, and eBay scaling."
            description="Choose between our general subscription plans or specialized data analytics packages."
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
                General Subscription Plans
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Data Analytics Plans
              </button>
            </div>
          </div>

          <div className="mt-12">
            {activeTab === 'subscription' && (
              <div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">General Subscription Plans</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      Choose the package that matches your product count, daily lookup needs, and support requirements.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
                  {subscriptionPlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">
                      No subscription plans configured yet. Ask admin to add plans in Admin Panel.
                    </div>
                  ) : (
                    subscriptionPlans.map((plan) => (
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
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">Data Analytics Plans</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      For users who want market analysis credits and a focused analytics workflow.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {analyticsVisiblePlans.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">
                      No analytics plans configured yet. Ask admin to add plans in Admin Panel.
                    </div>
                  ) : (
                    analyticsVisiblePlans.map((plan) => (
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
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100">Need help choosing?</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
                Start with the plan that matches your volume, then scale when the workflow proves itself.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                If you want to replace the visuals later, the layout already leaves room for screenshots, product
                shots, and brand assets without breaking the structure.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div>
                <p className="text-sm font-medium text-slate-200">Ready to continue?</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Open the portal or ask for a custom fit after you review the plans.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]"
                >
                  Get Started Now
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
                >
                  Review plans
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
