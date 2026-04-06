import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function ListingDetailPage() {
  const { isDark } = useTheme();
  const location = useLocation();
  const listing = location?.state?.listing || null;

  const keyFacts = useMemo(() => {
    if (!listing) return {};
    return {
      listingId: listing?.listingId || listing?.listing?.listingId || listing?.sku || '-',
      title: listing?.listing?.title || listing?.title || listing?.product?.title || '-',
      status: listing?.status || listing?.marketplaceId || '-',
      price: listing?.pricingSummary?.price?.value
        ? `${listing.pricingSummary.price.value} ${listing.pricingSummary.price.currency || ''}`.trim()
        : '-',
      quantity:
        typeof listing?.availableQuantity === 'number'
          ? listing.availableQuantity
          : listing?.quantity ?? listing?.availability?.shipToLocationAvailability?.quantity ?? '-',
      url: listing?.url || listing?.listing?.listingWebUrl || null,
    };
  }, [listing]);

  if (!listing) {
    return (
      <div className="page-shell">
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="mb-4">Listing details are unavailable. Open this page from the Listings table.</p>
          <Link to="/listings" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/listings" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </Link>
        {keyFacts.url ? (
          <a
            href={keyFacts.url}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex items-center gap-2"
          >
            View on eBay
            <ExternalLink size={16} />
          </a>
        ) : null}
      </div>

      <div className={`rounded-2xl border p-5 mb-4 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Listing Detail</h1>
        <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} text-sm`}>{keyFacts.title}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        {[
          ['Listing ID', keyFacts.listingId],
          ['Status', keyFacts.status],
          ['Price', keyFacts.price],
          ['Quantity', String(keyFacts.quantity)],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
            <p className={`text-sm font-bold mt-1 break-all ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Full payload</h2>
        <pre className={`text-xs overflow-auto max-h-[70vh] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {JSON.stringify(listing, null, 2)}
        </pre>
      </div>
    </div>
  );
}

