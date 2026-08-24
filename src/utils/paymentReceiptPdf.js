import { jsPDF } from 'jspdf';

const BRAND_CYAN = '#0891b2';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

function formatAmount(amount) {
  const n = Number(amount || 0);
  return `${n.toFixed(2)} AZN`;
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' });
}

function describePayment(payment) {
  if (payment.requestType === 'tracking_credits_topup') {
    return `Tracking Credits Top-Up (+${payment.requestedCredits || 0})`;
  }
  return payment.planName || 'Checkila ödənişi';
}

// Client-side receipt PDF for a single payment-history row, downloaded
// on-demand from the Settings → Ödəniş → Ödəniş tarixçəsi drawer. Mirrors
// the layout of the PDF the backend emails automatically after each
// successful payment (receiptService.js), just built with jsPDF instead of
// pdfkit since this one runs in the browser.
export function downloadPaymentReceiptPdf(payment, { customerName, customerEmail } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(BRAND_CYAN);
  doc.text('Checkila', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text('checkila.com', marginX, y + 16);

  y += 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(INK);
  doc.text('Ödəniş qəbzi', marginX, y);

  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text(`Qəbz №: ${payment.id}`, marginX, y);
  y += 14;
  doc.text(`Tarix: ${formatDate(payment.paidAt || payment.createdAt)}`, marginX, y);

  y += 20;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('MÜŞTƏRİ', marginX, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(customerName || customerEmail || 'Müştəri', marginX, y);
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
  doc.text('TƏSVİR', marginX, y);
  doc.text('MƏBLƏĞ', pageWidth - marginX, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(describePayment(payment), marginX, y, { maxWidth: pageWidth - marginX * 2 - 120 });
  doc.setFont('helvetica', 'bold');
  doc.text(formatAmount(payment.amount), pageWidth - marginX, y, { align: 'right' });

  y += 26;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(INK);
  doc.text('Cəmi', marginX, y);
  doc.text(formatAmount(payment.amount), pageWidth - marginX, y, { align: 'right' });

  y += 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text('ÖDƏNİŞ ÜSULU', marginX, y);
  y += 15;
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  doc.text(`Epoint onlayn ödəniş${payment.cardMask ? ` — kart ${payment.cardMask}` : ''}`, marginX, y);
  if (payment.transaction) {
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(`Əməliyyat ID: ${payment.transaction}`, marginX, y);
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
    'Bu, Checkila tərəfindən avtomatik yaradılmış ödəniş qəbzidir. Suallarınız olarsa checkilanotify@gmail.com ünvanına yazın.',
    pageWidth / 2,
    pageHeight - 48,
    { align: 'center', maxWidth: pageWidth - marginX * 2 }
  );

  doc.save(`checkila-qebz-${payment.id}.pdf`);
}
