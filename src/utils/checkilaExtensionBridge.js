// Shared messaging helper for talking to the Checkila browser extension from
// the web app (see extension/bridge.js, which only runs on checkila.com /
// www.checkila.com and relays these message types to background.js).
// Used by both OrderDetailPage's and OrdersPage's "Copy address" buttons so
// they share the exact same request/response handshake and timeout behavior.

// Sends the buyer's shipping address to the extension for storage, so the
// "Checkila Fill" button injected on Amazon's delivery address form
// (extension/amazon_checkila_fill_button.js) can fill it in later.
// Resolves with { success, error, unavailable } — `unavailable` means no
// response arrived within the timeout, most likely because the extension
// (or bridge.js) isn't installed/running on this page at all.
export function copyAddressToExtension({ shipTo, orderId }, { timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const requestId = `copy-address-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', onResult);
      resolve({ success: false, unavailable: true, error: null });
    }, timeoutMs);

    function onResult(event) {
      if (event.source !== window) return;
      if (event.data?.type !== 'CHECKILA_COPY_ADDRESS_RESULT') return;
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeoutId);
      window.removeEventListener('message', onResult);
      resolve({ success: !!event.data?.success, unavailable: false, error: event.data?.error || null });
    }
    window.addEventListener('message', onResult);

    window.postMessage(
      {
        type: 'CHECKILA_COPY_ADDRESS',
        requestId,
        payload: { orderId: orderId || null, shipTo },
      },
      window.location.origin
    );
  });
}
