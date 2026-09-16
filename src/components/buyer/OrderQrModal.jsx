import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  CheckCircle2,
  Building,
  Copy,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';

export const OrderQrModal = () => {
  const { activeQrOrder, setActiveQrOrder } = useApp();
  const [copied, setCopied] = useState(false);

  if (!activeQrOrder) return null;

  // `claimedAt` is also accepted because it is an irreversible server receipt.
  // This prevents an old cached status string from displaying a used pass active.
  const isClaimed = String(activeQrOrder.orderStatus || activeQrOrder.order_status || '').toUpperCase() === 'CLAIMED' || Boolean(activeQrOrder.claimedAt || activeQrOrder.claimed_at);
  
  // Use compact token for high-contrast, bold, instant barcode scanning (guaranteed string)
  const qrPayload = String(activeQrOrder.token || activeQrOrder.id || '');

  // Safely normalize items regardless of whether backend returns array, JSON string, or text
  const safeItems = Array.isArray(activeQrOrder.items)
    ? activeQrOrder.items
    : (typeof activeQrOrder.items === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(activeQrOrder.items);
              return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : [{ name: activeQrOrder.items, quantity: 1, price: 0 }]);
            } catch {
              return [{ name: activeQrOrder.items, quantity: 1, price: 0 }];
            }
          })()
        : (activeQrOrder.items && typeof activeQrOrder.items === 'object' ? [activeQrOrder.items] : []));

  const handleCopyOrderId = () => {
    if (activeQrOrder.id) {
      navigator.clipboard?.writeText(String(activeQrOrder.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatClaimedTime = (dateStr) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '' : ` at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return '';
    }
  };

  // Ask the same authoritative QR validation endpoint used by the counter.
  // This is independent of Realtime and the student's cached order list: as
  // soon as a vendor claim reaches the server, the rendered QR expires.
  useEffect(() => {
    if (!activeQrOrder?.token && !activeQrOrder?.id) return undefined;
    let stopped = false;
    const refreshClaimStatus = async () => {
      try {
        const data = await apiFetch('/api/orders/validate-qr', {
          method: 'POST',
          body: JSON.stringify({ token: activeQrOrder.token, orderId: activeQrOrder.id }),
          timeoutMs: 5000,
        });
        if (!stopped && data?.order) {
          setActiveQrOrder(previous => previous?.id === data.order.id ? { ...previous, ...data.order } : previous);
        }
      } catch (pollErr) {
        console.warn('[OrderQrModal] Status refresh note:', pollErr);
      }
    };
    refreshClaimStatus();
    const timer = window.setInterval(refreshClaimStatus, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeQrOrder?.id, activeQrOrder?.token, setActiveQrOrder]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-[#111827] border border-gray-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative text-gray-100 my-6">
        
        <button
          onClick={() => setActiveQrOrder(null)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          {!isClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/70 border border-orange-500/40 text-orange-400 text-xs font-bold mb-2 shadow-glow">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <span>Order Confirmed & Paid</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-xs font-bold mb-2">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <span>Food Claimed & QR Expired</span>
            </div>
          )}

          <h2 className="text-xl font-black text-white">
            Counter Pickup Pass
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="font-mono text-xs text-orange-400 font-bold">
              Order ID: #{activeQrOrder.id || 'N/A'}
            </span>
            <button
              onClick={handleCopyOrderId}
              className="text-gray-400 hover:text-white p-1 rounded transition"
              title="Copy Order ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-orange-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center my-3">
          <div
            className={`p-4 bg-white rounded-3xl shadow-2xl border-4 transition-all duration-300 relative ${
              isClaimed ? 'opacity-40 grayscale border-gray-700' : 'border-orange-500/80 shadow-glow'
            }`}
          >
            <QRCodeSVG
              value={qrPayload}
              size={200}
              level="M"
              includeMargin={true}
            />
            {isClaimed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl backdrop-blur-xs">
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-lg uppercase tracking-wider shadow">
                  CLAIMED / EXPIRED
                </span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 mt-3 text-center max-w-xs leading-relaxed">
            {!isClaimed
              ? 'Present this digital QR code to the canteen counter vendor to collect your food.'
              : `Handed over by ${activeQrOrder.claimedBy || activeQrOrder.claimed_by || 'canteen vendor'}${formatClaimedTime(activeQrOrder.claimedAt || activeQrOrder.claimed_at)}`}
          </p>
        </div>

        {/* Order Details Breakdown */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-3.5 space-y-2 text-xs">
          
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <span className="text-gray-400">Campus Location:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-orange-400" />
              {activeQrOrder.block || 'CB'} Block
            </span>
          </div>

          <div className="py-1 space-y-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Snacks Included:</div>
            {safeItems.map((item, idx) => {
              const itemName = item?.name || (typeof item === 'string' ? item : 'Snack Item');
              const itemQuantity = Number(item?.quantity) || 1;
              const itemPrice = Number(item?.price) || 0;
              return (
                <div key={idx} className="flex justify-between items-center text-gray-200">
                  <span>{itemQuantity}x {itemName}</span>
                  <span className="font-semibold text-gray-400">₹{itemPrice * itemQuantity}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
            <span className="text-gray-400">Total Paid ({activeQrOrder.paymentMethod || activeQrOrder.payment_method || 'UPI'}):</span>
            <span className="text-sm font-black text-orange-400">₹{activeQrOrder.finalAmount ?? activeQrOrder.final_amount ?? activeQrOrder.totalAmount ?? 0}</span>
          </div>

        </div>

        {/* Done Button */}
        <button
          onClick={() => setActiveQrOrder(null)}
          className="w-full mt-4 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition active:scale-98"
        >
          Close Pickup Pass
        </button>

      </div>
    </div>
  );
};

export default OrderQrModal;
