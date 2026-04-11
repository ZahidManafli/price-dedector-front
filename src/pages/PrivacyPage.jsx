import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-6">Last updated: April 1, 2026</p>

        <div className="space-y-5 text-slate-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Information We Collect</h2>
            <p>
              We collect account information (such as email), product links and prices that you
              add, and integration tokens needed to connect third-party services like eBay.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. How We Use Information</h2>
            <p>
              We use your data to provide price tracking, profit calculations, alerts, and optional
              automatic listing price updates when you connect supported marketplaces.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Third-Party Services</h2>
            <p>
              This app uses third-party providers for marketplace integrations, product lookup,
              and email delivery. Their services may process data necessary for app features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Data Security</h2>
            <p>
              We take reasonable steps to protect stored information, but no system can guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Your Choices</h2>
            <p>
              You can disconnect integrations, update product data, and request deletion of your
              account data by contacting the app owner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Contact</h2>
            <p>
              For privacy requests, contact: <span className="font-medium">checkila.app@gmail.com</span>
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

