import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

// A public (no login required) support/contact page — the in-app /support
// ticketing page requires an account, so it can't be linked as a public
// "Support URL" (e.g. in the Canva app listing) for people who aren't
// registered yet.
export default function SupportContactPage() {
  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto glass-card p-6 md:p-8 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="h-14 w-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Mail className="text-blue-600" size={24} />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Support</h1>
        <p className="text-slate-600 mb-6">
          Need help with Checkila or any of its integrations (eBay, Amazon, Canva)? Reach out and
          we'll get back to you.
        </p>
        <a
          href="mailto:checkilanotify@gmail.com"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Mail size={16} /> checkilanotify@gmail.com
        </a>
        <p className="text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Sign in
          </Link>{' '}
          to open a support ticket for faster, tracked help.
        </p>
        <div className="mt-6">
          <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}
