import React, { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';
import { partnerAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { renderAccentedTitle } from '../utils/accentedTitle';

// Landing page -> "Tərəfdaşlarımız". Partners come from Admin panel -> Tərəfdaşlar
// (partnerAPI.getPublic). Hero-style header, then an endless grey logo carousel:
// logos sit in greyscale and show their real colours on hover; the strip pauses
// while the pointer is over it. Short lists are repeated so the strip is never
// half empty.

const MIN_ITEMS_PER_LOOP = 10;

function PartnerLogo({ partner }) {
  const [broken, setBroken] = useState(false);
  const Tag = partner.website_url ? 'a' : 'div';
  const linkProps = partner.website_url
    ? { href: partner.website_url, target: '_blank', rel: 'noreferrer noopener' }
    : {};
  return (
    <Tag
      {...linkProps}
      title={partner.name}
      className="group flex h-20 shrink-0 items-center justify-center px-8 md:px-10"
    >
      {partner.logo_url && !broken ? (
        <img
          src={partner.logo_url}
          alt={partner.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="max-h-12 w-auto max-w-[170px] object-contain opacity-60 grayscale transition duration-300 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0 dark:opacity-70 dark:brightness-125"
        />
      ) : (
        <span className="whitespace-nowrap text-xl font-bold tracking-tight text-slate-400 transition duration-300 group-hover:text-slate-900 dark:text-slate-500 dark:group-hover:text-white">
          {partner.name}
        </span>
      )}
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

  // One loop of the strip: repeat short lists so the loop is wide enough.
  const loop = [];
  while (loop.length < Math.max(MIN_ITEMS_PER_LOOP, partners.length)) loop.push(...partners);

  return (
    <section className="relative w-full px-6 pb-20 pt-6 md:pb-28">
      <style>{`@keyframes partnersMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.partners-track{animation:partnersMarquee 40s linear infinite}.partners-marquee:hover .partners-track{animation-play-state:paused}@media (prefers-reduced-motion: reduce){.partners-track{animation:none}}`}</style>
      <div className="pointer-events-none absolute left-1/2 top-24 h-[300px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
            <Handshake size={14} />
            {t('landing:partners.eyebrow')}
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl" style={{ textWrap: 'balance' }}>
            {renderAccentedTitle(t('landing:partners.title'), t('landing:partners.titleAccents', { returnObjects: true }))}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:partners.description')}</p>
        </div>

        <div
          data-reveal="fade"
          data-reveal-delay="150"
          className="partners-marquee relative mt-12 overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          }}
        >
          <div className="partners-track flex w-max items-center">
            {[...loop, ...loop].map((partner, i) => (
              <div key={`${partner.id}-${i}`} aria-hidden={i >= partners.length ? 'true' : undefined}>
                <PartnerLogo partner={partner} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default PartnersSection;
