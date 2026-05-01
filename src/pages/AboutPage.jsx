import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">{t('aboutPage.title')}</h1>

        <div className="space-y-5 text-slate-700 leading-7">
          <p>{t('aboutPage.intro')}</p>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('aboutPage.whatWeDo')}</h2>
            <ul className="list-disc pl-6 space-y-1">
              {t('aboutPage.items', { returnObjects: true }).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('aboutPage.contact')}</h2>
            <p>{t('aboutPage.support')}</p>
          </section>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
            {t('aboutPage.backToApp')}
          </Link>
        </div>
      </div>
    </div>
  );
}

