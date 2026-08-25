import { jsPDF } from 'jspdf';

const BRAND_CYAN = '#0891b2';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const LOGO_URL = '/checkila-receipt-logo.png';

function formatAmount(amount, currency = 'AZN') {
  const n = Number(amount || 0);
  return `${n.toFixed(2)} ${currency}`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function describePayment(payment) {
  if (payment.requestType === 'tracking_credits_topup') {
    return `Tracking Credits Top-Up (+${payment.requestedCredits || 0})`;
  }
  return payment.planName || 'Checkila payment';
}

// jsPDF's built-in fonts (Helvetica etc.) only support WinAnsi encoding,
// which is missing several Azerbaijani letters (ə, ğ, ş, ı, ç render as
// garbage/missing glyphs) — so, like the backend's emailed receipt
// (receiptService.js), this is in English on purpose rather than pulling in
// a custom Unicode font just for a one-page receipt.
function loadImageAsDataUrl(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

// Client-side receipt PDF for a single payment-history row, downloaded
// on-demand from the Settings → Ödəniş → Ödəniş tarixçəsi drawer. Mirrors
// the layout of the PDF the backend emails automatically after each
// successful payment (receiptService.js), just built with jsPDF instead of
// pdfkit since this one runs in the browser.
export async function downloadPaymentReceiptPdf(payment, { customerName, customerEmail } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  try {
    const logoDataUrl = await loadImageAsDataUrl(LOGO_URL);
    doc.addImage(logoDataUrl, 'PNG', marginX, 40, 40, 40);
  } catch {
    // A missing/unreachable logo should never block downloading the receipt.
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(BRAND_CYAN);
  doc.text('Checkila', marginX + 50, 62);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('checkila.com', marginX + 50, 76);

  let y = 112;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(INK);
  doc.text('Payment Receipt', marginX, y);

  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`Receipt No: ${payment.id}`, marginX, y);
  y += 14;
  doc.text(`Date: ${formatDate(payment.paidAt || payment.createdAt)}`, marginX, y);

  y += 20;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('CUSTOMER', marginX, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(customerName || customerEmail || 'Customer', marginX, y);
  if (customerEmail) {
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(customerEmail, marginX, y);
  }

  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('DESCRIPTION', marginX, y);
  doc.text('AMOUNT', pageWidth - marginX, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(describePayment(payment), marginX, y, { maxWidth: pageWidth - marginX * 2 - 120 });
  doc.setFont('helvetica', 'bold');
  doc.text(formatAmount(payment.amount, payment.currency), pageWidth - marginX, y, { align: 'right' });

  y += 26;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text('Total', marginX, y);
  doc.text(formatAmount(payment.amount, payment.currency), pageWidth - marginX, y, { align: 'right' });

  y += 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('PAYMENT METHOD', marginX, y);
  y += 15;
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  doc.text(`Epoint online payment${payment.cardMask ? ` — card ${payment.cardMask}` : ''}`, marginX, y);
  if (payment.transaction) {
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(`Transaction ID: ${payment.transaction}`, marginX, y);
  }
  if (payment.traceId) {
    y += 13;
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(`Trace ID: ${payment.traceId}`, marginX, y);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(
    'This is an automatically generated payment receipt from Checkila. Questions? Email checkilanotify@gmail.com.',
    pageWidth / 2,
    pageHeight - 48,
    { align: 'center', maxWidth: pageWidth - marginX * 2 }
  );

  doc.save(`checkila-receipt-${payment.id}.pdf`);
}
