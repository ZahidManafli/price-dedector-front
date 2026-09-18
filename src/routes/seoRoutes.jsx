import React from 'react';
import { Route } from 'react-router-dom';
import { SEO_PAGES, SUPPORTED_LANGS, pathFor } from '../data/seoPages';
import FeatureLandingPage from '../pages/seo/FeatureLandingPage';
import EbayFeeCalculatorPage from '../pages/seo/EbayFeeCalculatorPage';

// Generates one <Route> per (page x language) combination from the single
// src/data/seoPages.js config, so adding a new marketing page never requires
// touching App.jsx directly.
export function buildSeoRoutes() {
  const routes = [];

  SEO_PAGES.forEach((page) => {
    SUPPORTED_LANGS.forEach((lang) => {
      const path = pathFor(page.key, lang);
      const element =
        page.key === 'ebayFeeCalculator' ? (
          <EbayFeeCalculatorPage lang={lang} />
        ) : (
          <FeatureLandingPage pageKey={page.key} lang={lang} />
        );

      routes.push(<Route key={path} path={path} element={element} />);
    });
  });

  return routes;
}
