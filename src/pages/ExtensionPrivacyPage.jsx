import React from 'react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { applySeo } from '../utils/seo';

export default function ExtensionPrivacyPage() {
  useEffect(() => {
    applySeo({
      title: 'Checkila Extension Privacy Policy | Buyer Sold History Extension',
      description:
        'Read the privacy policy for the Checkila browser extension, which helps eBay users view buyer sold history and related listing information.',
      canonical: 'https://checkila.com/extension-privacy',
    });
  }, []);

  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">Checkila Extension Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-6">Last updated: May 24, 2026</p>

        <div className="space-y-5 text-slate-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Overview</h2>
            <p>
              Checkila is a browser extension that helps eBay users view a buyer’s sold history and related listing information while browsing eBay.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Data We Access</h2>
            <p>
              The extension may access eBay page content that is already visible to you, such as buyer names, listing details, order details, and page context needed to display sold history.
            </p>
            <p className="mt-3">
              The extension may also use local browser storage to save user preferences and may use tabs, scripting, and alarms only to support the extension’s core display and update behavior.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. How We Use Data</h2>
            <p>
              We use data only to provide the extension’s single purpose: showing buyer sold history in a simple, convenient way inside eBay browsing sessions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Data Sharing</h2>
            <p>
              We do not sell user data. We do not transfer user data to third parties for advertising, profiling, or unrelated purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Remote Code</h2>
            <p>
              The extension does not use remote code. All extension behavior is packaged with the extension.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Your Choices</h2>
            <p>
              You can stop using the extension at any time by disabling or removing it from your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Contact</h2>
            <p>
              For privacy questions, contact: <span className="font-medium">checkilanotify@gmail.com</span>
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