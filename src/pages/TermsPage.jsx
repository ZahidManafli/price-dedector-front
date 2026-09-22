import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 mb-6">Last updated: September 22, 2026</p>

        <div className="space-y-5 text-slate-700 leading-7">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using Checkila, you agree to these Terms and Conditions. If
              you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Description of Service</h2>
            <p>
              Checkila is a platform that helps online resellers track product prices, manage
              marketplace listings, and connect optional third-party integrations (such as eBay,
              Amazon) to assist with their reselling workflow.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Accounts and Subscriptions</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity under your account. Some features require a paid subscription
              plan; pricing and included features are described on the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Third-Party Integrations</h2>
            <p>
              Features that connect to third-party services (including eBay and Amazon) are
              subject to those providers' own terms of service. Checkila is not responsible for the
              availability, accuracy, or policies of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Acceptable Use</h2>
            <p>
              You agree not to misuse the service, including attempting to disrupt it, accessing
              other users' data without authorization, or using it for any unlawful purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Limitation of Liability</h2>
            <p>
              The service is provided "as is" without warranties of any kind. Checkila is not liable
              for indirect, incidental, or consequential damages arising from your use of the service,
              including losses related to marketplace listings, pricing decisions, or third-party
              integrations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the service after changes
              are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">8. Contact</h2>
            <p>
              For questions about these Terms, contact: <span className="font-medium">checkilanotify@gmail.com</span>
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
