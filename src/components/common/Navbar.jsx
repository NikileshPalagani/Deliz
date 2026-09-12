import React from 'react';
import { Menu, ShoppingBag, Coins, User, LogOut, Shield, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Navbar = () => {
  const {
    currentUser,
    setIsSidebarOpen,
    setIsCartOpen,
    cartTotalQuantity,
    cartTotalAmount,
    currentTab,
    setCurrentTab,
    logout,
  } = useApp();

  const role = (typeof currentUser?.role === 'string' ? currentUser.role : 'student').toLowerCase();
  const isStudent = role === 'student';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-gray-800/80">
      <div className={`${isAdmin || isVendor ? 'max-w-7xl' : 'max-w-md'} mx-auto px-4 h-14 flex items-center justify-between`}>
        
        {/* Left: Hamburger & Brand Logo */}
        <div className="flex items-center gap-2">
          {isStudent && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white active:bg-gray-800 transition"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => {
              if (isStudent) setCurrentTab('menu');
              if (isVendor) setCurrentTab('scanner');
              if (isAdmin) setCurrentTab('admin_stats');
            }}
            className="flex items-center gap-2 cursor-pointer active:scale-98 transition"
          >
            <div className="w-8 h-8 rounded-xl p-0.5 flex items-center justify-center">
              <img
                src="/images/deliz-icon.png"
                alt="Deliz Logo"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-black text-sm text-white tracking-tight">
                  Deliz
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold uppercase tracking-wider">
                  CVR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Coins & Cart */}
        <div className="flex items-center gap-2">
          {isStudent && (
            <>
              {/* Coin Balance Pill */}
              <button
                onClick={() => setCurrentTab('profile')}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 text-[11px] font-bold transition active:scale-95"
                title="Reward Coins"
              >
                <span>🪙</span>
                <span>{currentUser?.coins ?? 0}</span>
              </button>

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 active:from-orange-600 active:to-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 transition min-h-[36px]"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Cart</span>
                {cartTotalQuantity > 0 && (
                  <span className="bg-black/30 backdrop-blur-sm px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ml-0.5">
                    {cartTotalQuantity}
                  </span>
                )}
              </button>
            </>
          )}

          {isVendor && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTab(currentTab === 'profile' ? 'scanner' : 'profile')}
                className={`p-2 rounded-xl text-xs font-bold transition active:scale-95 border flex items-center justify-center ${
                  currentTab === 'profile'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/25'
                    : 'bg-orange-950/60 border-orange-700/60 text-orange-400 hover:bg-orange-900/60'
                }`}
                title="Vendor Profile"
                aria-label="Vendor Profile"
              >
                <User className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-xl bg-gray-800 text-gray-300 hover:text-rose-400 border border-gray-700 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/60 border border-purple-700/60 rounded-xl text-purple-300 text-xs font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-xl bg-gray-800 text-gray-300 active:text-rose-400 border border-gray-700 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
