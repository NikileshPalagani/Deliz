import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  CheckCircle2,
  Building,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';

export const OrderQrModal = () => {
  const { activeQrOrder, setActiveQrOrder } = useApp();
  const [copied, setCopied] = useState(false);

  if (!activeQrOrder) return null;

  const isClaimed = activeQrOrder.orderStatus === 'CLAIMED';
  // Use compact token for high-contrast, bold, instant barcode scanning
  const qrPayload = activeQrOrder.token || activeQrOrder.id;

  const handleCopyOrderId = () => {
    navigator.clipboard?.writeText(activeQrOrder.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Order ID: #{activeQrOrder.id}
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
              : `Handed over by ${activeQrOrder.claimedBy || 'canteen vendor'}${formatClaimedTime(activeQrOrder.claimedAt)}`}
          </p>
        </div>

        {/* Reward Coins Banner */}
        {activeQrOrder.coinsEarned > 0 && (
          <div className="p-2.5 bg-gradient-to-r from-amber-950/40 via-orange-950/40 to-amber-950/40 border border-amber-500/40 rounded-2xl flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Bonus Coins Earned:</span>
            </div>
            <span className="font-extrabold text-orange-400 text-xs">
              +{activeQrOrder.coinsEarned} Coins 🪙
            </span>
          </div>
        )}

        {/* Order Details Breakdown */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-3.5 space-y-2 text-xs">
          
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <span className="text-gray-400">Campus Location:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-orange-400" />
              {activeQrOrder.block} Block
            </span>
          </div>

          <div className="py-1 space-y-1">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Snacks Included:</div>
            {activeQrOrder.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-gray-200">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-semibold text-gray-400">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
            <span className="text-gray-400">Total Paid ({activeQrOrder.paymentMethod}):</span>
            <span className="text-sm font-black text-orange-400">₹{activeQrOrder.finalAmount}</span>
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
