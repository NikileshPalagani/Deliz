import React, { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingBag, ArrowRight, Megaphone, X } from 'lucide-react';
import { MENU_ITEMS } from '../../types';
import { useApp } from '../../context/AppContext';

export const MenuCatalog = () => {
  const {
    cart,
    addToCart,
    removeFromCart,
    setIsCartOpen,
    cartTotalQuantity,
    cartTotalAmount,
    menuItems,
  } = useApp();
  const [imageErrors, setImageErrors] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedNotice, setDismissedNotice] = useState(false);

  useEffect(() => {
    fetch('/api/announcements/active')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(() => {});
  }, []);

  const itemsToDisplay = menuItems && menuItems.length > 0 ? menuItems : MENU_ITEMS;

  const handleImageError = (id) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
      
      {/* Active Announcements Banner */}
      {!dismissedNotice && announcements.length > 0 && (
        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-transparent border border-orange-500/40 relative flex items-start gap-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-orange-500/30 flex items-center justify-center shrink-0 mt-0.5 text-orange-400">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-xs font-bold text-orange-300 tracking-wide uppercase">
              {announcements[0].title}
            </h4>
            <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
              {announcements[0].message}
            </p>
          </div>
          <button
            onClick={() => setDismissedNotice(true)}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg text-gray-400 hover:text-white"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Menu
          </h1>
          <p className="text-xs text-gray-400">
            Freshly prepared snacks ready for pickup
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold">
          {itemsToDisplay.length} Items
        </span>
      </div>

      {/* Food Cards */}
      <div className="space-y-4">
        {itemsToDisplay.map((item) => {
          const quantity = cart[item.id] || 0;
          const hasImageError = imageErrors[item.id];
          const displayImage = hasImageError ? item.fallbackImage : item.image;

          return (
            <div
              key={item.id}
              className="bg-[#111827] border border-gray-800 rounded-3xl overflow-hidden shadow-card-dark transition flex flex-col"
            >
              {/* Food Image Container */}
              <div className="relative h-52 w-full overflow-hidden bg-gray-900">
                <img
                  src={displayImage}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  onError={() => handleImageError(item.id)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-black/20" />

                {/* Veg/Non-Veg Dietary Indicator */}
                <div className="absolute top-3 right-3">
                  <div className="p-1.5 rounded-xl bg-black/70 backdrop-blur-sm border border-gray-700 flex items-center justify-center">
                    <div
                      className={`w-4 h-4 border-2 ${
                        item.isVeg ? 'border-green-600' : 'border-red-600'
                      } flex items-center justify-center rounded-sm`}
                      title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.isVeg ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body with Big Food Name & Price */}
              <div className="p-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {item.name}
                  </h2>
                  <div className="text-lg sm:text-xl font-extrabold text-orange-400 mt-0.5">
                    ₹{item.price}
                  </div>
                </div>

                {/* Add to Cart Actions */}
                <div>
                  {quantity === 0 ? (
                    <button
                      onClick={() => addToCart(item.id, 1)}
                      className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md shadow-orange-500/25 transition flex items-center gap-1.5 active:scale-95 min-h-[46px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-2xl p-1.5 shadow-inner">
                      <button
                        onClick={() => addToCart(item.id, -1)}
                        className="w-9 h-9 rounded-xl bg-gray-800 active:bg-gray-700 text-gray-200 flex items-center justify-center transition"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center font-black text-base text-white">
                        {quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item.id, 1)}
                        className="w-9 h-9 rounded-xl bg-orange-500 active:bg-orange-600 text-white flex items-center justify-center transition shadow"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Floating Sticky Mobile Bottom Cart Bar */}
      {cartTotalQuantity > 0 && (
        <div className="fixed bottom-4 inset-x-3 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-5">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-orange-400/40 text-white active:scale-98 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold text-orange-100 uppercase tracking-wider">
                  {cartTotalQuantity} {cartTotalQuantity === 1 ? 'item' : 'items'}
                </div>
                <div className="text-base font-black">
                  ₹{cartTotalAmount}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 font-bold text-xs bg-black/25 px-3.5 py-2 rounded-xl backdrop-blur-sm">
              <span>View Cart</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

    </div>
  );
};
