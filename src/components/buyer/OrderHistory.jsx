import React, { useState, useMemo } from 'react';
import { Clock, QrCode, Building, ShoppingBag } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const OrderHistory = () => {
  const { orders, setActiveQrOrder, setCurrentTab } = useApp();
  const [filter, setFilter] = useState('ALL');

  const safeFormatTime = (dateStr) => {
    try {
      if (!dateStr) return 'Just now';
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => {
      if (!o) return false;
      if (filter === 'PENDING') return o.orderStatus === 'PENDING_PICKUP';
      if (filter === 'CLAIMED') return o.orderStatus === 'CLAIMED';
      return true;
    });
  }, [orders, filter]);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <span>Order History</span>
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Active pickups and previous canteen orders.
        </p>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-900 border border-gray-800 rounded-2xl text-xs mb-4">
        {['ALL', 'PENDING', 'CLAIMED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1.5 rounded-xl font-bold transition text-xs ${
              filter === tab
                ? 'bg-orange-500 text-white shadow'
                : 'text-gray-400 active:text-white'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab === 'PENDING' ? 'Active' : 'Claimed'}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-10 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white mb-1">No orders found</h3>
          <p className="text-xs text-gray-400 mb-5">
            You have no orders in this tab.
          </p>
          <button
            onClick={() => setCurrentTab('menu')}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow transition active:scale-95"
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map((order) => {
            const isClaimed = String(order.orderStatus || '').toUpperCase() === 'CLAIMED' || Boolean(order.claimedAt || order.claimed_at);
            return (
              <div
                key={order.id}
                className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-orange-400">
                      #{order.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isClaimed
                          ? 'bg-gray-800 text-gray-400 border-gray-700'
                          : 'bg-orange-950/80 text-orange-400 border-orange-800'
                      }`}
                    >
                      {isClaimed ? 'Claimed' : 'Active Pickup'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {safeFormatTime(order.createdAt)}
                  </span>
                </div>

                {/* Items summary */}
                {(() => {
                  const safeItems = Array.isArray(order.items)
                    ? order.items
                    : (typeof order.items === 'string'
                        ? (() => {
                            try {
                              const parsed = JSON.parse(order.items);
                              return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : [{ name: order.items, quantity: 1, price: 0 }]);
                            } catch {
                              return [{ name: order.items, quantity: 1, price: 0 }];
                            }
                          })()
                        : (order.items && typeof order.items === 'object' ? [order.items] : []));
                  const summary = safeItems.length > 0
                    ? safeItems.map(i => `${Number(i?.quantity) || 1}x ${i?.name || (typeof i === 'string' ? i : 'Item')}`).join(' • ')
                    : 'Order Items';
                  return (
                    <div className="text-xs font-semibold text-white">
                      {summary}
                    </div>
                  );
                })()}

                {/* Location & payment info */}
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-800/80">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3 h-3 text-orange-400" />
                    <span>{order?.block || 'CB'} Block</span>
                  </div>
                  <div className="font-extrabold text-white text-sm">
                    ₹{order?.finalAmount ?? order?.final_amount ?? order?.totalAmount ?? 0}
                  </div>
                </div>

                <button
                  onClick={() => setActiveQrOrder(order)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow active:scale-98 ${
                    isClaimed
                      ? 'bg-gray-800 text-gray-300 border border-gray-700'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{isClaimed ? 'View Receipt Pass' : 'Open Pickup Pass'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
