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
    const priceValue = listing?.pricingSummary?.price?.value;
    const priceCurrency = listing?.pricingSummary?.price?.currency;
    return {
      listingId: listing?.listingId || listing?.listing?.listingId || listing?.sku || '-',
      title: listing?.listing?.title || listing?.title || listing?.product?.title || '-',
      status: listing?.status || listing?.marketplaceId || '-',
      price: priceValue != null ? `${priceValue} ${priceCurrency || ''}`.trim() : '-',
      quantity:
        typeof listing?.availableQuantity === 'number'
          ? listing.availableQuantity
          : listing?.quantity ?? listing?.availability?.shipToLocationAvailability?.quantity ?? '-',
      url: listing?.url || listing?.listing?.listingWebUrl || null,
      source: listing?._source || listing?.source || '-',
    };
  }, [listing]);

  const meta = useMemo(() => {
    if (!listing) return {};
    return {
      site: listing?.site || listing?.marketplaceId || 'eBay',
      category: listing?.primaryCategory?.name || listing?.categoryName || '',
      created: listing?.listingStartDate || listing?.startTime || null,
      ended: listing?.listingEndDate || listing?.endTime || null,
      condition: listing?.conditionDisplayName || listing?.condition || '',
      location: listing?.location || listing?.itemLocation || '',
    };
  }, [listing]);

  const gallery = useMemo(() => {
    const images = [];
    if (Array.isArray(listing?.pictures)) {
      images.push(...listing.pictures);
    }
    if (listing?.pictureUrl && Array.isArray(listing.pictureUrl)) {
      images.push(...listing.pictureUrl);
    }
    if (listing?.pictureDetails?.pictureUrl && Array.isArray(listing.pictureDetails.pictureUrl)) {
      images.push(...listing.pictureDetails.pictureUrl);
    }
    return images.slice(0, 8);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Marketplace</p>
          <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{meta.site}</p>
          {meta.category && (
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Category: {meta.category}</p>
          )}
          {meta.condition && (
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Condition: {meta.condition}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Timing</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Started:{' '}
            <span className="font-semibold">
              {meta.created ? new Date(meta.created).toLocaleString() : 'N/A'}
            </span>
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Ended:{' '}
            <span className="font-semibold">
              {meta.ended ? new Date(meta.ended).toLocaleString() : '—'}
            </span>
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Location</p>
          <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {meta.location || '—'}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Source: {keyFacts.source}</p>
        </div>
      </div>

      {gallery.length > 0 && (
        <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {gallery.map((src) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
              >
                <img src={src} alt="" className="h-24 w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

