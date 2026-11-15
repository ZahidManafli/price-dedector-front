import React, { useEffect, useState } from 'react';
import { ExternalLink, Handshake } from 'lucide-react';
import { partnerAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { renderAccentedTitle } from '../utils/accentedTitle';

// Landing page -> "Tərəfdaşlarımız". Partners come from Admin panel -> Tərəfdaşlar
// (partnerAPI.getPublic). Same visual language as the hero: centered header with
// a gradient accent, soft glow, equal-size cards with the logo fitted inside and
// the partner's name under it (so a logo drawn for dark backgrounds is still
// identifiable on white). More than 5 partners -> an endless, pausable marquee.

const MARQUEE_FROM = 6;

function PartnerCard({ partner }) {
  const [broken, setBroken] = useState(false);
  const Tag = partner.website_url ? 'a' : 'div';
  const linkProps = partner.website_url
    ? { href: partner.website_url, target: '_blank', rel: 'noreferrer noopener', title: partner.name }
    : { title: partner.name };
  return (
    <Tag
      {...linkProps}
      className="group relative flex h-full min-h-[9.5rem] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 px-6 py-6 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-cyan-300/30 dark:hover:shadow-black/30"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400 opacity-0 blur-2xl transition duration-300 group-hover:opacity-20" aria-hidden="true" />
      <div className="relative flex h-16 w-full items-center justify-center">
        {partner.logo_url && !broken ? (
          <img
            src={partner.logo_url}
            alt={partner.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="max-h-16 max-w-[85%] object-contain transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
            <Handshake size={22} />
          </span>
        )}
      </div>
      <span className="relative inline-flex items-center justify-center gap-1 text-center text-sm font-medium text-slate-600 transition group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
        {partner.name}
        {partner.website_url && <ExternalLink size={12} className="opacity-0 transition group-hover:opacity-70" />}
      </span>
    </Tag>
  );
}

function PartnersSection() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useTranslation('landing');

  useEffect(() => {
    const loadPartners = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await partnerAPI.getPublic();
        setPartners(res.data.data || []);
      } catch (err) {
        console.error('Error loading partners:', err);
        setError(t('landing:partners.error'));
      } finally {
        setLoading(false);
      }
    };

    loadPartners();
  }, []);

  if (loading) return null;
  if (error) return null;
  if (!partners || partners.length === 0) return null;

  const marquee = partners.length >= MARQUEE_FROM;

  return (
    <section className="relative w-full px-6 pb-20 pt-6 md:pb-28">
      <style>{`@keyframes partnersMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.partners-track{animation:partnersMarquee 40s linear infinite}.partners-marquee:hover .partners-track{animation-play-state:paused}@media (prefers-reduced-motion: reduce){.partners-track{animation:none}}`}</style>
      <div className="pointer-events-none absolute left-1/2 top-24 h-[300px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
            <Handshake size={14} />
            {t('landing:partners.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl" style={{ textWrap: 'balance' }}>
            {renderAccentedTitle(t('landing:partners.title'), t('landing:partners.titleAccents', { returnObjects: true }))}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:partners.description')}</p>
        </div>

        {marquee ? (
          <div
            className="partners-marquee relative mt-12 overflow-hidden"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
            }}
          >
            <div className="partners-track flex w-max gap-4 py-2">
              {[...partners, ...partners].map((partner, i) => (
                <div key={`${partner.id}-${i}`} className="w-60 shrink-0" aria-hidden={i >= partners.length ? 'true' : undefined}>
                  <PartnerCard partner={partner} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`mx-auto mt-12 grid grid-cols-2 gap-4 ${partners.length >= 4 ? 'lg:grid-cols-4' : partners.length === 3 ? 'md:grid-cols-3' : ''} ${partners.length <= 2 ? 'max-w-xl' : ''}`}>
            {partners.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default PartnersSection;
