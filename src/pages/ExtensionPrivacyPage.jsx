import React from 'react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { applySeo } from '../utils/seo';

export default function ExtensionPrivacyPage() {
  useEffect(() => {
    applySeo({
      title: 'Checkila Extension Privacy Policy',
      description:
        'Privacy policy for Checkila browser extension used to analyze eBay purchase history data.',
      canonical: 'https://checkila.com/extension-privacy',
    });
  }, []);

  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">
          Checkila Extension Privacy Policy
        </h1>

        <p className="text-sm text-slate-500 mb-6">
          Last updated: June 2026
        </p>

        <div className="space-y-6 text-slate-700 leading-7">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              1. Overview
            </h2>
            <p>
              Checkila Extension is a browser tool that helps users analyze eBay purchase history data and generate structured insights for personal use.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              2. Data We Access
            </h2>
            <p>
              The extension processes only user-visible content from eBay pages that the user actively visits, such as purchase history information, listing details, and order-related data.
            </p>
            <p className="mt-3">
              The extension may also use Chrome storage to keep authentication state (such as a session token) and may use browser APIs like tabs and scripting solely to read and process page content that is already visible to the user.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              3. How We Use Data
            </h2>
            <p>
              All processed data is used only to provide the core functionality of the extension: analyzing purchase history and generating structured analytics for the user.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              4. Data Storage
            </h2>
            <p>
              Authentication tokens and minimal session data are stored locally in the user's browser using Chrome storage APIs. No passwords or sensitive financial data are stored.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              5. Data Sharing
            </h2>
            <p>
              We do not sell or rent user data. Selected processed data is securely transmitted only to Checkila backend services (https://back.checkila.com) for generating analytics results.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              6. Remote Code
            </h2>
            <p>
              This extension does not execute remote code. All functionality is included within the packaged extension files.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              7. User Control
            </h2>
            <p>
              Users can disable or remove the extension at any time through their browser settings. All data processing stops immediately upon uninstall or logout.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              8. Security
            </h2>
            <p>
              All communication between the extension and backend services is encrypted using HTTPS to ensure secure data transmission.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              9. Contact
            </h2>
            <p>
              For privacy-related questions, contact:{" "}
              <span className="font-medium">checkilanotify@gmail.com</span>
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