import React from 'react';
import { UtensilsCrossed, QrCode, User, ShoppingBag } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav = () => {
  const { currentTab, setCurrentTab, currentUser, orders, setIsCartOpen, cartTotalQuantity } = useApp();

  const role = (typeof currentUser?.role === 'string' ? currentUser.role : 'student').toLowerCase();
  if (!currentUser || role !== 'student') return null;

  const safeOrders = Array.isArray(orders) ? orders : [];
  const activeOrdersCount = safeOrders.filter(o => o && o.orderStatus === 'PENDING_PICKUP').length;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-[#0B0F19]/95 backdrop-blur-lg border-t border-gray-800">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        
        {/* Menu Tab */}
        <button
          onClick={() => setCurrentTab('menu')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            currentTab === 'menu'
              ? 'text-orange-400 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${currentTab === 'menu' ? 'bg-orange-500/15' : ''}`}>
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>

        {/* QR Passes Tab */}
        <button
          onClick={() => setCurrentTab('qr_history')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 relative transition ${
            currentTab === 'qr_history'
              ? 'text-orange-400 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-xl relative transition ${currentTab === 'qr_history' ? 'bg-orange-500/15' : ''}`}>
            <QrCode className="w-5 h-5" />
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                {activeOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">Pickup QR</span>
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            currentTab === 'profile'
              ? 'text-orange-400 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition ${currentTab === 'profile' ? 'bg-orange-500/15' : ''}`}>
            <User className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">Profile</span>
        </button>

      </div>
    </div>
  );
};
