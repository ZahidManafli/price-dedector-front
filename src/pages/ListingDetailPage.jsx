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

  const trading = useMemo(() => {
    const xml = listing?.rawXml;
    if (!xml || typeof DOMParser === 'undefined') return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const root = doc.querySelector('Item') || doc;
      const text = (selector) => root.querySelector(selector)?.textContent?.trim() || '';
      const allText = (selector) =>
        Array.from(root.querySelectorAll(selector))
          .map((n) => n.textContent?.trim())
          .filter(Boolean);
      const money = (selector) => {
        const n = root.querySelector(selector);
        if (!n) return '';
        const value = n.textContent?.trim() || '';
        const currency = n.getAttribute('currencyID') || text('Currency');
        return value ? `${value} ${currency || ''}`.trim() : '';
      };
      return {
        autoPay: text('AutoPay'),
        buyerProtection: text('BuyerProtection'),
        country: text('Country'),
        listingDuration: text('ListingDuration'),
        startTime: text('ListingDetails > StartTime'),
        endTime: text('ListingDetails > EndTime'),
        timeLeft: text('TimeLeft'),
        viewUrl: text('ListingDetails > ViewItemURL') || text('ListingDetails > ViewItemURLForNaturalSearch'),
        location: text('Location'),
        postalCode: text('PostalCode'),
        site: text('Site'),
        shipToLocations: allText('ShipToLocations').join(', '),
        quantity: text('Quantity'),
        quantitySold: text('SellingStatus > QuantitySold'),
        listingStatus: text('SellingStatus > ListingStatus'),
        bidCount: text('SellingStatus > BidCount'),
        currentPrice: money('SellingStatus > CurrentPrice'),
        minimumToBid: money('SellingStatus > MinimumToBid'),
        bestOfferCount: text('BestOfferDetails > BestOfferCount'),
        bestOfferEnabled: text('BestOfferDetails > BestOfferEnabled'),
        returnsAccepted: text('ReturnPolicy > ReturnsAccepted'),
        returnsWithin: text('ReturnPolicy > ReturnsWithin'),
        shippingPaidBy: text('ReturnPolicy > ShippingCostPaidBy'),
        condition: text('ConditionDisplayName'),
        categoryId: text('PrimaryCategory > CategoryID'),
        categoryName: text('PrimaryCategory > CategoryName'),
        sellerShippingProfile: text('SellerProfiles > SellerShippingProfile > ShippingProfileName'),
        sellerReturnProfile: text('SellerProfiles > SellerReturnProfile > ReturnProfileName'),
        sellerPaymentProfile: text('SellerProfiles > SellerPaymentProfile > PaymentProfileName'),
        secureDescription: text('IsSecureDescription'),
        hideFromSearch: text('HideFromSearch'),
        locationDefaulted: text('LocationDefaulted'),
        buyerResponsibleShipping: text('BuyerResponsibleForShipping'),
        pictureUrls: allText('PictureDetails > PictureURL'),
      };
    } catch {
      return null;
    }
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
    if (trading?.pictureUrls?.length) images.push(...trading.pictureUrls);
    return Array.from(new Set(images)).slice(0, 24);
  }, [listing, trading]);

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
          ['Status', trading?.listingStatus || keyFacts.status],
          ['Price', trading?.currentPrice || keyFacts.price],
          ['Quantity', String(trading?.quantity || keyFacts.quantity)],
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
          <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{trading?.site || meta.site}</p>
          {(trading?.categoryName || meta.category) && (
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Category: {trading?.categoryName || meta.category}</p>
          )}
          {(trading?.condition || meta.condition) && (
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Condition: {trading?.condition || meta.condition}</p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Timing</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Started:{' '}
            <span className="font-semibold">
              {trading?.startTime ? new Date(trading.startTime).toLocaleString() : meta.created ? new Date(meta.created).toLocaleString() : 'N/A'}
            </span>
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Ended:{' '}
            <span className="font-semibold">
              {trading?.endTime ? new Date(trading.endTime).toLocaleString() : meta.ended ? new Date(meta.ended).toLocaleString() : '—'}
            </span>
          </p>
          {trading?.timeLeft && (
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Time left: <span className="font-semibold">{trading.timeLeft}</span></p>
          )}
        </div>
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Location</p>
          <p className={`text-sm font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {trading?.location || meta.location || '—'}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {trading?.postalCode ? `Postal code: ${trading.postalCode}` : ''}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Source: {keyFacts.source} {trading?.country ? `• Country: ${trading.country}` : ''}</p>
        </div>
      </div>

      {trading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Sales</h2>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Current price: <span className="font-semibold">{trading.currentPrice || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Minimum bid: <span className="font-semibold">{trading.minimumToBid || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Sold qty: <span className="font-semibold">{trading.quantitySold || '0'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Bid count: <span className="font-semibold">{trading.bidCount || '0'}</span></p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Offers & Returns</h2>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Best offer enabled: <span className="font-semibold">{trading.bestOfferEnabled || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Best offer count: <span className="font-semibold">{trading.bestOfferCount || '0'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Returns accepted: <span className="font-semibold">{trading.returnsAccepted || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Return window: <span className="font-semibold">{trading.returnsWithin || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Return shipping paid by: <span className="font-semibold">{trading.shippingPaidBy || '-'}</span></p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h2 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Seller & Compliance</h2>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Shipping profile: <span className="font-semibold">{trading.sellerShippingProfile || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Return profile: <span className="font-semibold">{trading.sellerReturnProfile || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Payment profile: <span className="font-semibold">{trading.sellerPaymentProfile || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Secure description: <span className="font-semibold">{trading.secureDescription || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Hide from search: <span className="font-semibold">{trading.hideFromSearch || '-'}</span></p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>AutoPay: <span className="font-semibold">{trading.autoPay || '-'}</span></p>
          </div>
        </div>
      )}

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

