import React, { useEffect, useState } from 'react';
import { partnerAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const PARTNER_STYLES = {
  'Luhive': {
    wrapClass: 'flex items-center justify-center p-6 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-cyan-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none dark:backdrop-blur dark:hover:border-cyan-300/30 dark:hover:bg-slate-900/60 transition-all duration-300 group',
    imgClass: 'max-h-16 max-w-full object-contain cursor-pointer transition-all duration-300',
    imgStyle: { height: '4rem' },
  },
  'Lumu Hub': {
    wrapClass: 'flex items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm hover:border-cyan-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none dark:backdrop-blur dark:hover:border-cyan-300/30 dark:hover:bg-slate-900/60 transition-all duration-300 group',
    imgClass: 'object-contain cursor-pointer transition-all duration-300',
    imgStyle: { height: '7rem' },
  },
};

const DEFAULT_PARTNER_STYLE = {
  wrapClass: 'flex items-center justify-center p-6 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-cyan-500/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none dark:backdrop-blur dark:hover:border-cyan-300/30 dark:hover:bg-slate-900/60 transition-all duration-300 group',
  imgClass: 'max-h-16 max-w-full object-contain cursor-pointer transition-all duration-300',
  imgStyle: {},
};

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

  return (
    <section className="w-full py-16 md:py-24 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 dark:border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100">
            {t('landing:partners.eyebrow')}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {t('landing:partners.title')}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
            {t('landing:partners.description')}
          </p>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-12 items-center justify-center">
          {partners.map((partner) => {
            const style = PARTNER_STYLES[partner.name] || DEFAULT_PARTNER_STYLE;
            return (
              <a
                key={partner.id}
                href={partner.website_url || undefined}
                target={partner.website_url ? '_blank' : undefined}
                rel={partner.website_url ? 'noreferrer noopener' : undefined}
                className={style.wrapClass}
              >
                {partner.logo_url ? (
                  <img
                    src={partner.logo_url}
                    alt={partner.name}
                    className={style.imgClass}
                    style={style.imgStyle}
                    title={partner.name}
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{partner.name}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default PartnersSection;
