import React from 'react';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="page-shell">
      <div className="max-w-3xl mx-auto glass-card p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-6 tracking-tight">About Checkila</h1>

        <div className="space-y-5 text-slate-700 leading-7">
          <p>
            Checkila helps online sellers track Amazon and eBay prices, estimate profit, and
            react quickly when costs change.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">What We Do</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Track Amazon product price changes</li>
              <li>Calculate profit using your configured formula</li>
              <li>Store price history for each product</li>
              <li>Send notifications when important changes happen</li>
              <li>Optionally sync recommended prices to connected eBay listings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Contact</h2>
            <p>Support email: checkila.app@gmail.com</p>
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

