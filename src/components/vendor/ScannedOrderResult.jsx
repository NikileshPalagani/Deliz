import React, { useEffect } from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  Building,
  ShoppingBag,
  User,
  Clock,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ScannedOrderResult = ({ result, onClose, onOrderClaimed }) => {
  const { triggerCelebration } = useApp();

  if (!result) return null;

  const order = result.order;
  const isAlreadyClaimed = result.alreadyClaimed;

  useEffect(() => {
    if (!isAlreadyClaimed && result.success) {
      triggerCelebration();
    }
  }, [isAlreadyClaimed, result]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-[#111827] border border-gray-800 w-full max-w-lg rounded-3xl p-5 sm:p-7 shadow-2xl relative text-gray-100 my-6">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status Header */}
        <div className="text-center mb-5">
          {isAlreadyClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-950/70 border border-rose-800 text-rose-400 text-xs font-black mb-2">
              <AlertOctagon className="w-4 h-4" />
              <span>QR ALREADY EXPIRED & CLAIMED</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500 text-emerald-400 text-xs font-black mb-2 shadow-glow">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>QR SCANNED SUCCESSFULLY!</span>
            </div>
          )}

          <h2 className="text-xl font-black text-white">
            Order #{order?.id}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAlreadyClaimed ? 'This pass was previously fulfilled.' : 'Order Verified • Hand Over Food Items'}
          </p>
        </div>

        {/* Food Items to Hand Over */}
        <div className="bg-gradient-to-r from-orange-950/40 to-amber-950/40 border-2 border-orange-500/40 rounded-2xl p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-black uppercase text-orange-400 tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" />
              <span>Food Items to Dispense:</span>
            </span>
            <span>Quantity</span>
          </div>

          <div className="divide-y divide-gray-800/80">
            {order?.items?.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-base font-bold text-white">{item.name}</span>
                </div>
                <span className="text-base font-black text-orange-400 px-3 py-1 rounded-xl bg-black/50 border border-orange-500/20">
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Student & Destination Info */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-3.5 space-y-2 text-xs mb-5">
          <div className="flex justify-between items-center text-gray-300">
            <span className="text-gray-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Student:
            </span>
            <span className="font-bold text-white">{order?.studentName} ({order?.studentEmail})</span>
          </div>

          <div className="flex justify-between items-center text-gray-300">
            <span className="text-gray-400 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-orange-400" /> Block:
            </span>
            <span className="font-extrabold text-orange-400">{order?.block} Block</span>
          </div>

          <div className="flex justify-between items-center text-gray-300">
            <span className="text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Order Time:
            </span>
            <span>{new Date(order?.createdAt || Date.now()).toLocaleTimeString()}</span>
          </div>

          {isAlreadyClaimed && (
            <div className="pt-2 border-t border-gray-800 flex justify-between text-rose-400 font-bold">
              <span>Claimed Previously:</span>
              <span>By {order?.claimedBy || 'vendor'} at {new Date(order?.claimedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        {!isAlreadyClaimed ? (
          <button
            onClick={() => {
              if (onOrderClaimed && order) onOrderClaimed(order);
              onClose();
            }}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 active:scale-98"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Complete Handover / Done</span>
          </button>
        ) : (
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-xs transition active:scale-98"
          >
            Back to Scanner
          </button>
        )}

      </div>
    </div>
  );
};
