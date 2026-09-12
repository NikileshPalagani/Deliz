import React from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PaymentHistory = () => {
  const { orders } = useApp();

  const safeFormatDateTime = (dateStr) => {
    try {
      if (!dateStr) return 'Recent';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Recent';
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recent';
    }
  };

  const safeOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
      <div className="mb-4">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-400" />
          <span>Payment Receipts</span>
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          UPI and Razorpay transaction records.
        </p>
      </div>

      {safeOrders.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-10 text-center">
          <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white mb-1">No payments yet</h3>
          <p className="text-xs text-gray-400">
            Transactions made via PhonePe, GPay, Navi, or Razorpay will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {safeOrders.map((o) => (
            <div
              key={o.id}
              className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark transition space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono font-black text-white text-xs">
                    Order #{o.id}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {o.transactionId || `TXN-${o.id}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-orange-400 text-sm">
                    ₹{o.finalAmount}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-950/60 border border-orange-800/60 px-2 py-0.2 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Paid</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
                <span>Method: <strong className="text-gray-200">{o.paymentMethod || 'UPI'}</strong></span>
                <span>{safeFormatDateTime(o.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
