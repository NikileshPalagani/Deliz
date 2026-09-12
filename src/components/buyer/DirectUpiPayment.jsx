import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Coins,
  RefreshCw,
  X,
  ArrowRight,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAppUpiUrls, launchUpiUrlSafely } from '../../utils/upi';

export const DirectUpiPayment = ({ isOpen, onClose }) => {
  const {
    finalPayableAmount,
    validCoinsRedeemed,
    coinDiscountInRupees,
    potentialCoinsEarned,
    selectedBlock,
    createOrder,
  } = useApp();

  const [processing, setProcessing] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const orderPlacedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      orderPlacedRef.current = false;
      setProcessing(false);
      setSelectedApp(null);
      setStatusMessage('');
    }
  }, [isOpen]);

  const getRandomId = () => {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return 1000 + (array[0] % 9000);
    }
    return Date.now().toString().slice(-4);
  };

  const appUrls = getAppUpiUrls({
    amount: finalPayableAmount,
    orderId: `CB${getRandomId()}`,
  });

  // Single-execution Order Finalizer
  const finalizePayment = async (appName) => {
    if (orderPlacedRef.current) return;
    orderPlacedRef.current = true;
    setProcessing(true);
    setStatusMessage(`Verifying & confirming payment...`);

    try {
      const res = await createOrder({
        method: `UPI (${appName || 'UPI App'})`,
        transactionId: `UPI-${Date.now()}`
      });

      if (res.success) {
        onClose();
      } else {
        alert(res.message || 'Failed to record order.');
        orderPlacedRef.current = false;
        setProcessing(false);
      }
    } catch (e) {
      console.error('Finalize payment error:', e);
      orderPlacedRef.current = false;
      setProcessing(false);
    }
  };

  const handleLaunchPayment = (appName, url) => {
    setSelectedApp(appName);
    setStatusMessage(`Opening ${appName}... Generating your Pickup Token QR Code.`);
    launchUpiUrlSafely(url);
    // Smoothly finalize order and generate token without dropping connections
    setTimeout(() => {
      finalizePayment(appName);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#111827] border-t sm:border border-gray-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative text-gray-100 max-h-[90vh] overflow-y-auto">
        
        {/* Mobile Pull Bar */}
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={processing}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 text-orange-400 text-xs font-bold mb-1.5 border border-orange-500/30">
            <Lock className="w-3.5 h-3.5" />
            <span>UPI Instant Checkout</span>
          </div>
          <h2 className="text-xl font-black text-white">
            Select UPI Payment App
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Pickup: <span className="text-orange-400 font-semibold">{selectedBlock} Block</span>
          </p>
        </div>

        {/* Amount Summary */}
        <div className="bg-gradient-to-r from-orange-950/70 to-amber-950/70 border border-orange-500/40 rounded-2xl p-4 mb-4 text-center">
          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
            Total Payable Amount
          </div>
          <div className="text-3xl font-black text-orange-400 mt-0.5">
            ₹{finalPayableAmount}
          </div>
          {coinDiscountInRupees > 0 && (
            <div className="text-xs text-amber-300 font-semibold mt-1">
              (₹{coinDiscountInRupees} Discount Applied for {validCoinsRedeemed} Coins)
            </div>
          )}
          <div className="text-xs text-orange-300 font-medium mt-1.5 flex items-center justify-center gap-1">
            <Coins className="w-3.5 h-3.5 text-orange-400" />
            <span>You will earn +{potentialCoinsEarned} Coins (1 coin per ₹5 spent)</span>
          </div>
        </div>

        {/* Processing State */}
        {processing ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-10 h-10 text-orange-500 animate-spin" />
            <div className="text-sm font-bold text-white">
              {statusMessage || 'Processing Payment...'}
            </div>
            <p className="text-xs text-gray-400">
              Generating your single unique Pickup Token QR Code...
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Choose App to Complete Payment:
            </div>

            {/* PhonePe */}
            <button
              onClick={() => handleLaunchPayment('PhonePe', appUrls.phonepe)}
              className="w-full p-3.5 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 rounded-2xl flex items-center justify-between transition group active:scale-98 min-h-[52px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white text-sm shadow">
                  पे
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-purple-200">
                    PhonePe
                  </div>
                  <div className="text-[11px] text-gray-400">Instant UPI Payment</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Google Pay */}
            <button
              onClick={() => handleLaunchPayment('Google Pay', appUrls.gpay)}
              className="w-full p-3.5 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/60 rounded-2xl flex items-center justify-between transition group active:scale-98 min-h-[52px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-black text-blue-600 text-xs shadow">
                  GPay
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-blue-200">
                    Google Pay
                  </div>
                  <div className="text-[11px] text-gray-400">Fast UPI Checkout</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Navi */}
            <button
              onClick={() => handleLaunchPayment('Navi', appUrls.navi)}
              className="w-full p-3.5 bg-orange-950/40 hover:bg-orange-900/60 border border-orange-800/60 rounded-2xl flex items-center justify-between transition group active:scale-98 min-h-[52px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-black text-white text-sm shadow">
                  N
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-orange-200">
                    Navi UPI
                  </div>
                  <div className="text-[11px] text-gray-400">Direct Bank Payment</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Paytm / Any UPI App */}
            <button
              onClick={() => handleLaunchPayment('UPI App', appUrls.generic)}
              className="w-full p-3.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 rounded-2xl flex items-center justify-between transition group active:scale-98 min-h-[52px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white text-sm shadow">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-white group-hover:text-orange-200">
                    Paytm / Any Other UPI App
                  </div>
                  <div className="text-[11px] text-gray-400">All registered UPI handles</div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
