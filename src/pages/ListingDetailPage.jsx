import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ebayAPI } from '../services/api';

export default function ListingDetailPage() {
  const { isDark } = useTheme();
  const location = useLocation();
  const initialListing = location?.state?.listing || null;
  const [listing, setListing] = useState(initialListing);
  const [selectedImage, setSelectedImage] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [priceDraft, setPriceDraft] = useState('');
  const [saveTitleLoading, setSaveTitleLoading] = useState(false);
  const [savePriceLoading, setSavePriceLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

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

  useEffect(() => {
    setSelectedImage(gallery[0] || '');
  }, [gallery]);

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  useEffect(() => {
    const currentTitle = listing?.listing?.title || listing?.title || listing?.product?.title || '';
    const currentPrice =
      listing?.pricingSummary?.price?.value ??
      (trading?.currentPrice ? String(trading.currentPrice).split(' ')[0] : '');
    setTitleDraft(currentTitle);
    setPriceDraft(currentPrice ? String(currentPrice) : '');
  }, [listing, trading?.currentPrice]);

  const handleUpdateTitle = async () => {
    const listingId = keyFacts.listingId;
    if (!listingId || listingId === '-') return;
    if (!titleDraft.trim()) {
      setSaveError('Title cannot be empty.');
      setSaveSuccess('');
      return;
    }
    setSaveTitleLoading(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await ebayAPI.updateListing(listingId, { title: titleDraft.trim() });
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: titleDraft.trim(),
          listing: {
            ...(prev.listing || {}),
            title: titleDraft.trim(),
          },
        };
      });
      setSaveSuccess('Title updated successfully.');
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || 'Failed to update title.');
    } finally {
      setSaveTitleLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    const listingId = keyFacts.listingId;
    if (!listingId || listingId === '-') return;
    const parsed = Number(priceDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSaveError('Enter a valid positive price.');
      setSaveSuccess('');
      return;
    }
    setSavePriceLoading(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      await ebayAPI.updateListing(listingId, { price: parsed, currency: 'USD' });
      setListing((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pricingSummary: {
            ...(prev.pricingSummary || {}),
            price: {
              value: parsed.toFixed(2),
              currency: 'USD',
            },
          },
        };
      });
      setSaveSuccess('Price updated successfully.');
    } catch (err) {
      setSaveError(err?.response?.data?.error || err?.message || 'Failed to update price.');
    } finally {
      setSavePriceLoading(false);
    }
  };

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
      <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <div className="grid grid-cols-[72px,1fr] gap-3">
              <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
                {(gallery.length ? gallery : ['']).map((src, idx) => (
                  <button
                    key={`${src}-${idx}`}
                    type="button"
                    onClick={() => src && setSelectedImage(src)}
                    className={`w-[64px] h-[64px] rounded-lg border overflow-hidden ${
                      selectedImage === src
                        ? isDark
                          ? 'border-indigo-400'
                          : 'border-indigo-500'
                        : isDark
                        ? 'border-slate-700'
                        : 'border-slate-300'
                    }`}
                  >
                    {src ? (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    )}
                  </button>
                ))}
              </div>
              <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                {selectedImage ? (
                  <img src={selectedImage} alt={keyFacts.title} className="w-full h-[540px] object-contain" />
                ) : (
                  <div className="h-[540px] flex items-center justify-center text-sm opacity-70">
                    No image
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <h1 className={`text-3xl font-bold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {keyFacts.title}
            </h1>
            <div className={`mt-4 pb-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Price</p>
              <p className={`text-4xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {trading?.currentPrice || keyFacts.price}
              </p>
              <p className={`mt-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Status: <span className="font-semibold">{trading?.listingStatus || keyFacts.status}</span>
              </p>
            </div>
            <div className={`mt-4 space-y-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p><span className="font-semibold">Listing ID:</span> {keyFacts.listingId}</p>
              <p><span className="font-semibold">Condition:</span> {trading?.condition || meta.condition || '-'}</p>
              <p><span className="font-semibold">Quantity:</span> {trading?.quantity || keyFacts.quantity} <span className="opacity-70 ml-1">(Sold: {trading?.quantitySold || 0})</span></p>
              <p><span className="font-semibold">Best Offer:</span> {trading?.bestOfferEnabled || '-'} {trading?.bestOfferCount ? `(${trading.bestOfferCount})` : ''}</p>
              <p><span className="font-semibold">Watch / Bids:</span> {trading?.bidCount || 0}</p>
              <p><span className="font-semibold">Brand:</span> {meta.category || trading?.categoryName || '-'}</p>
              <p><span className="font-semibold">Start:</span> {trading?.startTime ? new Date(trading.startTime).toLocaleDateString() : '-'}</p>
              <p><span className="font-semibold">End:</span> {trading?.endTime ? new Date(trading.endTime).toLocaleDateString() : '-'}</p>
              <p><span className="font-semibold">Location:</span> {trading?.location || meta.location || '-'} {trading?.postalCode ? `(${trading.postalCode})` : ''}</p>
            </div>
            <div className={`mt-4 rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Seller profiles</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Shipping: {trading?.sellerShippingProfile || '-'}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Return: {trading?.sellerReturnProfile || '-'}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Payment: {trading?.sellerPaymentProfile || '-'}</p>
            </div>
            <div className={`mt-4 rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Quick edit listing</p>
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Title</label>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleUpdateTitle}
                    disabled={saveTitleLoading}
                    className="btn-secondary mt-2"
                  >
                    {saveTitleLoading ? 'Updating title...' : 'Update title'}
                  </button>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleUpdatePrice}
                    disabled={savePriceLoading}
                    className="btn-secondary mt-2"
                  >
                    {savePriceLoading ? 'Updating price...' : 'Update price'}
                  </button>
                </div>
              </div>
              {saveError ? (
                <p className={`text-xs mt-3 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>{saveError}</p>
              ) : null}
              {saveSuccess ? (
                <p className={`text-xs mt-3 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{saveSuccess}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Shipping, returns & policies</h2>
          <div className={`space-y-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <p><span className="font-semibold">Ships to:</span> {trading?.shipToLocations || '-'}</p>
            <p><span className="font-semibold">Buyer protection:</span> {trading?.buyerProtection || '-'}</p>
            <p><span className="font-semibold">Returns accepted:</span> {trading?.returnsAccepted || '-'}</p>
            <p><span className="font-semibold">Return window:</span> {trading?.returnsWithin || '-'}</p>
            <p><span className="font-semibold">Return shipping paid by:</span> {trading?.shippingPaidBy || '-'}</p>
            <p><span className="font-semibold">Buyer responsible shipping:</span> {trading?.buyerResponsibleShipping || '-'}</p>
          </div>
        </div>
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Listing health</h2>
          <div className={`space-y-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <p><span className="font-semibold">Listing duration:</span> {trading?.listingDuration || '-'}</p>
            <p><span className="font-semibold">Time left:</span> {trading?.timeLeft || '-'}</p>
            <p><span className="font-semibold">AutoPay:</span> {trading?.autoPay || '-'}</p>
            <p><span className="font-semibold">Secure description:</span> {trading?.secureDescription || '-'}</p>
            <p><span className="font-semibold">Hide from search:</span> {trading?.hideFromSearch || '-'}</p>
            <p><span className="font-semibold">Location defaulted:</span> {trading?.locationDefaulted || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

