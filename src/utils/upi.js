import { UPI_CONFIG } from '../types';

/**
 * Generate standard UPI Payment URL
 */
export const buildUpiUrl = ({ amount, orderId = 'CB-ORDER', note = 'Deliz Order' }) => {
  const pa = encodeURIComponent(UPI_CONFIG.vpa);
  const pn = encodeURIComponent(UPI_CONFIG.name);
  const am = encodeURIComponent(Number(amount).toFixed(2));
  const tn = encodeURIComponent(`${note} #${orderId}`);
  const tr = encodeURIComponent(`CB-${orderId}-${Date.now()}`);

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&tr=${tr}&cu=INR`;
};

/**
 * App-specific deep links with safe URI scheme
 */
export const getAppUpiUrls = (params) => {
  const standardUpi = buildUpiUrl(params);
  const encodedStandard = encodeURIComponent(standardUpi);

  return {
    generic: standardUpi,
    phonepe: `phonepe://pay?pa=${encodeURIComponent(UPI_CONFIG.vpa)}&pn=${encodeURIComponent(UPI_CONFIG.name)}&am=${encodeURIComponent(params.amount)}&cu=INR&tn=${encodeURIComponent(params.orderId || 'Deliz')}`,
    gpay: `tez://upi/pay?pa=${encodeURIComponent(UPI_CONFIG.vpa)}&pn=${encodeURIComponent(UPI_CONFIG.name)}&am=${encodeURIComponent(params.amount)}&cu=INR&tn=${encodeURIComponent(params.orderId || 'Deliz')}`,
    paytm: `paytmmp://pay?pa=${encodeURIComponent(UPI_CONFIG.vpa)}&pn=${encodeURIComponent(UPI_CONFIG.name)}&am=${encodeURIComponent(params.amount)}&cu=INR&tn=${encodeURIComponent(params.orderId || 'Deliz')}`,
    navi: standardUpi, // Navi handles standard upi:// scheme
  };
};

/**
 * Non-destructive UPI deep link launcher that prevents page navigation errors on Desktop/Chrome
 */
export const launchUpiUrlSafely = (url) => {
  try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Create hidden link and click
      const a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 1000);
    } else {
      // On desktop, window.location might fail if no handler; open safely or let user scan QR
      window.open(url, '_blank');
    }
  } catch (err) {
    console.warn('UPI launcher trigger:', err);
  }
};
