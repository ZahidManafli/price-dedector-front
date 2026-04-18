import React, { useEffect, useState } from 'react';
import { partnerAPI } from '../services/api';

function PartnersSection() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPartners = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await partnerAPI.getPublic();
        setPartners(res.data.data || []);
      } catch (err) {
        console.error('Error loading partners:', err);
        setError('Failed to load partners');
      } finally {
        setLoading(false);
      }
    };

    loadPartners();
  }, []);

  if (loading) return null;
  if (error) return null;
  if (!partners || partners.length === 0) return null;

  return (
    <section className="w-full py-16 md:py-24 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Our Partners
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
            Trusted by Leading Platforms
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            We partner with industry-leading companies to bring you the best solutions and services
          </p>
        </div>

        {/* Partners Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-12 items-center justify-center">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-center p-6 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur hover:border-cyan-300/30 hover:bg-slate-900/60 transition-all duration-300 group"
            >
              {partner.logo_url ? (
                <img
                  src={partner.logo_url}
                  alt={partner.name}
                  className="max-h-16 max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                  title={partner.name}
                />
              ) : (
                <div className="text-center">
                  <span className="text-sm font-medium text-slate-400">{partner.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PartnersSection;
