// Epoint's digital-wallet widget (/token/widget) is a single generic
// endpoint for both Google Pay and Apple Pay — there's no request param to
// pick one, Epoint's iframe just shows whichever the visiting browser/device
// supports. So the only thing we control is the button's own label/branding.
export function isApplePaySupported() {
  try {
    return typeof window !== 'undefined'
      && typeof window.ApplePaySession !== 'undefined'
      && window.ApplePaySession.canMakePayments();
  } catch {
    return false;
  }
}

export function getWalletPaymentLabel() {
  return isApplePaySupported() ? 'Apple Pay' : 'Google Pay';
}
