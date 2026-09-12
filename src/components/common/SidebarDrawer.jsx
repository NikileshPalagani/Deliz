import React from 'react';
import {
  Utensils,
  Clock,
  CreditCard,
  QrCode,
  User,
  LogOut,
  X,
  Building,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SidebarDrawer = () => {
  const {
    currentUser,
    isSidebarOpen,
    setIsSidebarOpen,
    currentTab,
    setCurrentTab,
    logout,
  } = useApp();

  if (!isSidebarOpen) return null;

  const navItems = [
    { id: 'menu', label: 'Food Menu', icon: Utensils, desc: 'Fresh campus snacks' },
    { id: 'orders', label: 'Order History', icon: Clock, desc: 'View past & active food orders' },
    { id: 'payments', label: 'Payment Receipts', icon: CreditCard, desc: 'UPI transactions' },
    { id: 'qr_history', label: 'QR Pickup Passes', icon: QrCode, desc: 'Active pickup barcodes' },
    { id: 'profile', label: 'Account Details', icon: User, desc: 'Personal details & preferences' },
  ];

  const handleSelectTab = (tabId) => {
    setCurrentTab(tabId);
    setIsSidebarOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in">
      {/* Backdrop */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Off-Canvas Sidebar */}
      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-xs bg-[#111827] border-r border-gray-800 text-gray-100 flex flex-col shadow-2xl">
          
          {/* Header & User Summary */}
          <div className="p-4 border-b border-gray-800 bg-[#0B0F19]/60 relative">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-3.5 right-3.5 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5">
                <div className="w-full h-full bg-[#111827] rounded-[14px] flex items-center justify-center text-orange-400 font-black text-base">
                  {currentUser?.name?.charAt(0) || 'S'}
                </div>
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-white text-sm truncate">
                  {currentUser?.name || 'CVR Student'}
                </h4>
                <p className="text-xs text-orange-400 font-medium truncate">
                  {currentUser?.email}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                  <span className="flex items-center gap-0.5">
                    <Building className="w-3 h-3 text-orange-400" />
                    {currentUser?.block || 'CB'} Block
                  </span>
                </div>
              </div>
            </div>

            {/* Coins Widget in Drawer */}
            <div className="mt-3 p-2 bg-gray-900/90 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Reward Coins:</span>
              </div>
              <span className="font-extrabold text-orange-400 text-xs">
                🪙 {currentUser?.coins ?? 0}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
                    isActive
                      ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400 font-semibold'
                      : 'text-gray-300 hover:bg-gray-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="text-[10px] text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-gray-600'}`} />
                </button>
              );
            })}
          </nav>

          {/* Footer & Logout */}
          <div className="p-3 border-t border-gray-800 bg-[#0B0F19]/40">
            <button
              onClick={logout}
              className="w-full py-2.5 px-3 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/50 text-rose-400 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 active:scale-98"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
