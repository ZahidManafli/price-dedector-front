import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { settingsAPI } from '../services/api';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [currencyRates, setCurrencyRates] = useState({
    AZN_to_USD: 0.588,
    AZN_to_RUB: 57.5,
    AZN_to_TL: 19.5,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Language mapping to currency
  const languageToCurrency = {
    en: { code: 'USD', rate: 'AZN_to_USD' },
    az: { code: 'AZN', rate: null }, // AZN is base currency
    ru: { code: 'RUB', rate: 'AZN_to_RUB' },
    tr: { code: 'TL', rate: 'AZN_to_TL' },
  };

  // Fetch currency rates from backend on mount
  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        const response = await settingsAPI.getCurrencyRates?.();
        if (response?.data?.rates) {
          setCurrencyRates(response.data.rates);
        }
      } catch (err) {
        console.error('Failed to fetch currency rates:', err);
        setError(err.message);
        // Keep default rates if fetch fails
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  // Convert price from AZN to target currency based on language
  const convertPrice = (aznAmount, language = i18n.language) => {
    if (!aznAmount) return { amount: 0, currency: 'AZN', displayCurrency: 'AZN' };

    const currencyInfo = languageToCurrency[language] || languageToCurrency['en'];
    const amount = Number(aznAmount) || 0;

    // If language is Azerbaijani, return AZN unchanged
    if (language === 'az' || !currencyInfo.rate) {
      return {
        amount: parseFloat(amount.toFixed(2)),
        currency: currencyInfo.code,
        displayCurrency: currencyInfo.code,
      };
    }

    // Convert from AZN to target currency
    const rate = currencyRates[currencyInfo.rate] || 1;
    const convertedAmount = amount * rate;

    return {
      amount: parseFloat(convertedAmount.toFixed(2)),
      currency: currencyInfo.code,
      displayCurrency: currencyInfo.code,
    };
  };

  // Format price for display
  const formatPrice = (aznAmount, language = i18n.language) => {
    const { amount, displayCurrency } = convertPrice(aznAmount, language);
    return `${amount.toFixed(2)} ${displayCurrency}`;
  };

  // What currency an actual Epoint payment should be charged in — reuses the
  // exact same languageToCurrency lookup (and its "anything unrecognized
  // falls back to English/USD" behavior) that the price preview above uses,
  // so a browser-detected locale like "en-US" or "en-GB" (which convertPrice
  // already treats as English via that fallback) can't show a USD preview
  // but then silently charge AZN because some other check only matched the
  // bare string 'en'. Only ever returns 'AZN' or 'USD' — Epoint doesn't take
  // RUB/TL, so ru/tr stay AZN here even though they preview in RUB/TL.
  const getPaymentCurrency = (language = i18n.language) => {
    const currencyInfo = languageToCurrency[language] || languageToCurrency['en'];
    return currencyInfo.code === 'USD' ? 'USD' : 'AZN';
  };

  // Change language
  const changeLanguage = async (lang) => {
    try {
      await i18n.changeLanguage(lang);
      localStorage.setItem('userLanguage', lang);
    } catch (err) {
      console.error('Failed to change language:', err);
    }
  };

  // Get current language
  const currentLanguage = i18n.language || 'en';

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        changeLanguage,
        convertPrice,
        formatPrice,
        getPaymentCurrency,
        currencyRates,
        loading,
        error,
        languageToCurrency,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
