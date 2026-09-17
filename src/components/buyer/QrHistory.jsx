import React, { Component } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Eye, CheckCircle2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Localized Error Boundary for QrHistory
 */
class QrHistoryErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('⚠️ [QrHistory local boundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-8 text-center text-gray-100">
            <QrCode className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-2">QR Passes Temporarily Unavailable</h3>
            <p className="text-xs text-gray-400 mb-5">
              Unable to load your QR passes at this moment. You can view your orders in the Orders tab.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const QrHistoryContent = () => {
  const { orders = [], setActiveQrOrder, setCurrentTab } = useApp();

  const validOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
      <div className="mb-6">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <QrCode className="w-5 h-5 text-orange-400" />
          <span>Your QR Pickup Passes</span>
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Digital barcodes for instant counter pickup.
        </p>
      </div>

      {validOrders.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-10 text-center">
          <QrCode className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No QR passes available</h3>
          <p className="text-xs text-gray-400 mb-5">
            Place an order from the menu to get your instant pickup barcode!
          </p>
          <button
            onClick={() => setCurrentTab('menu')}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95"
          >
            Order Food Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {validOrders.map((order, index) => {
            const isClaimed = String(order?.orderStatus || order?.order_status || '').toUpperCase() === 'CLAIMED' || Boolean(order?.claimedAt || order?.claimed_at);
            const rawPayload = order?.token || order?.id;
            const qrPayload = rawPayload != null ? String(rawPayload).trim() : '';

            const safeItems = Array.isArray(order?.items)
              ? order.items
              : (typeof order?.items === 'string'
                  ? (() => {
                      try {
                        const parsed = JSON.parse(order.items);
                        return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : [{ name: order.items, quantity: 1, price: 0 }]);
                      } catch {
                        return [{ name: order.items, quantity: 1, price: 0 }];
                      }
                    })()
                  : (order?.items && typeof order?.items === 'object' ? [order.items] : []));

            const itemsSummary = safeItems.length > 0
              ? safeItems.map(i => `${Number(i?.quantity) || 1}x ${i?.name || (typeof i === 'string' ? i : 'Item')}`).join(', ')
              : 'Snacks Order';

            return (
              <div
                key={order?.id || `qr-order-${index}`}
                className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark flex flex-col justify-between items-center text-center relative overflow-hidden group hover:border-gray-700 transition"
              >
                <div className="w-full flex items-center justify-between mb-3 text-xs">
                  <span className="font-mono font-bold text-orange-400">#{order?.id || 'N/A'}</span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isClaimed
                        ? 'bg-gray-800 text-gray-500 border-gray-700'
                        : 'bg-orange-950/80 text-orange-400 border-orange-800'
                    }`}
                  >
                    {isClaimed ? 'EXPIRED' : 'ACTIVE'}
                  </span>
                </div>

                {/* QR Display */}
                <div
                  onClick={() => setActiveQrOrder(order)}
                  className={`p-3 bg-white rounded-2xl shadow-lg cursor-pointer transition transform active:scale-95 relative ${
                    isClaimed ? 'opacity-40 grayscale' : 'border-2 border-orange-500/80'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label="Open Pickup Modal"
                >
                  {qrPayload ? (
                    <QRCodeSVG value={qrPayload} size={150} level="M" includeMargin={true} />
                  ) : (
                    <div className="w-[150px] h-[150px] flex items-center justify-center bg-gray-100 rounded-xl text-gray-500 text-xs">
                      QR unavailable
                    </div>
                  )}
                  {isClaimed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                      <CheckCircle2 className="w-8 h-8 text-orange-400" />
                    </div>
                  )}
                </div>

                <div className="mt-4 w-full">
                  <div className="text-xs font-bold text-white truncate">
                    {itemsSummary}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-2">
                    <span>{order?.block || 'CB'} Block</span>
                    <span>•</span>
                    <span className="font-bold text-orange-400">₹{order?.finalAmount ?? order?.final_amount ?? order?.totalAmount ?? 0}</span>
                  </div>

                  <button
                    onClick={() => setActiveQrOrder(order)}
                    className="w-full mt-3 py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <Eye className="w-3.5 h-3.5 text-orange-400" />
                    <span>Open Pickup Modal</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const QrHistory = () => {
  return (
    <QrHistoryErrorBoundary>
      <QrHistoryContent />
    </QrHistoryErrorBoundary>
  );
};

export default QrHistory;
