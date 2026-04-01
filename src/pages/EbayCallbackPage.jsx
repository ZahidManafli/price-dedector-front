import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';

export default function EbayCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const finishOauth = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setAlert({ type: 'error', message: `eBay authorization failed: ${error}` });
        setLoading(false);
        return;
      }
      if (!code || !state) {
        setAlert({ type: 'error', message: 'Missing eBay OAuth code/state' });
        setLoading(false);
        return;
      }

      try {
        await ebayAPI.completeCallback(code, state);
        setAlert({ type: 'success', message: 'eBay account connected successfully' });
        setTimeout(() => navigate('/settings'), 1200);
      } catch (err) {
        setAlert({
          type: 'error',
          message: err.response?.data?.error || 'Failed to complete eBay connection',
        });
      } finally {
        setLoading(false);
      }
    };

    finishOauth();
  }, [navigate, searchParams]);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Connecting eBay</h1>
        {loading && <p className="text-gray-600 mb-4">Finalizing your eBay authorization...</p>}
        {alert && (
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        )}
      </div>
    </div>
  );
}

