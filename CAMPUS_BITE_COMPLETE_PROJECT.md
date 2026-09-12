# 🍔 Campus Bite — Complete Full-Stack Codebase

**Application Name**: Campus Bite  
**Tagline**: Good Food • Great Mood  
**Architecture**: React 18 + Vite + Tailwind CSS (Mobile-First) + Express Backend API (Port 5001)  
**Binary Zip Archive**: [campus-bite.zip](file:///Users/divya/.gemini/antigravity/brain/40cc37a4-ee10-47f5-88d5-178cad563fc7/campus-bite.zip)

---

## 📁 Complete File Tree

```
campus-bite/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── render.yaml
├── server.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── types.js
│   ├── index.css
│   ├── context/
│   │   └── AppContext.jsx
│   ├── utils/
│   │   ├── api.js
│   │   ├── otpService.js
│   │   ├── supabaseClient.js
│   │   ├── upi.js
│   │   └── storage.js
│   └── components/
│       ├── auth/
│       │   ├── UnifiedLogin.jsx
│       │   └── BuyerSignUp.jsx
│       ├── common/
│       │   ├── Navbar.jsx
│       │   ├── MobileBottomNav.jsx
│       │   ├── SidebarDrawer.jsx
│       │   └── OtpModal.jsx
│       ├── buyer/
│       │   ├── MenuCatalog.jsx
│       │   ├── CartModal.jsx
│       │   ├── DirectUpiPayment.jsx
│       │   ├── OrderQrModal.jsx
│       │   ├── OrderHistory.jsx
│       │   ├── PaymentHistory.jsx
│       │   ├── QrHistory.jsx
│       │   └── UserProfile.jsx
│       ├── vendor/
│       │   ├── VendorDashboard.jsx
│       │   ├── VendorProfile.jsx
│       │   ├── QrScannerModal.jsx
│       │   └── ScannedOrderResult.jsx
│       └── admin/
│           └── AdminDashboard.jsx
└── public/
    └── images/
        ├── samosa.png / samosa.svg
        ├── veg-puff.png / veg-puff.jpg
        ├── egg-puff.png / egg-puff.jpg
        ├── chicken-puff.png / chicken-puff.jpg
        └── logo.png / logo.jpg
```

---

## 1. `src/types.js`
```javascript
export const MENU_ITEMS = [
  {
    id: 'samosa',
    name: 'Samosa',
    price: 12,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: true,
    image: '/images/samosa.png',
    fallbackImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'veg_puff',
    name: 'Veg Puff',
    price: 25,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: true,
    image: '/images/veg-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'egg_puff',
    name: 'Egg Puff',
    price: 25,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: false,
    image: '/images/egg-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'chicken_puff',
    name: 'Chicken Puff',
    price: 30,
    category: 'Snacks',
    unit: 'pcs',
    isVeg: false,
    image: '/images/chicken-puff.png',
    fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
  },
];

export const BLOCKS = [
  { id: 'CB', code: 'CB', name: 'Civil Block' },
  { id: 'CM', code: 'CM', name: 'Computer Science and Mechanical Block' },
  { id: 'FB', code: 'FB', name: 'First year Block' },
  { id: 'PG', code: 'PG', name: 'Post Graduate Block' },
];

export const COIN_EARN_PER_ORDER = 1;
export const COIN_REDEEM_VALUE = 1; // 1 Coin = ₹1 Discount
```

---

## 2. `src/App.jsx`
```jsx
import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { UnifiedLogin } from './components/auth/UnifiedLogin';
import { BuyerSignUp } from './components/auth/BuyerSignUp';
import { Navbar } from './components/common/Navbar';
import { SidebarDrawer } from './components/common/SidebarDrawer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { MenuCatalog } from './components/buyer/MenuCatalog';
import { CartModal } from './components/buyer/CartModal';
import { OrderQrModal } from './components/buyer/OrderQrModal';
import { OrderHistory } from './components/buyer/OrderHistory';
import { PaymentHistory } from './components/buyer/PaymentHistory';
import { QrHistory } from './components/buyer/QrHistory';
import { UserProfile } from './components/buyer/UserProfile';
import { VendorDashboard } from './components/vendor/VendorDashboard';
import { VendorProfile } from './components/vendor/VendorProfile';
import { AdminDashboard } from './components/admin/AdminDashboard';

const MainLayout = () => {
  const { currentUser, currentTab } = useApp();
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'

  // Not logged in -> Show Unified Login or Sign Up
  if (!currentUser) {
    if (authView === 'signup') {
      return <BuyerSignUp onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <UnifiedLogin onSwitchToSignUp={() => setAuthView('signup')} />;
  }

  // Role: Vendor (vendor1 to vendor12, custom vendor usernames)
  if (currentUser.role === 'vendor') {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
        <Navbar />
        <main className="flex-1">
          {currentTab === 'profile' ? <VendorProfile /> : <VendorDashboard />}
        </main>
      </div>
    );
  }

  // Role: Admin
  if (currentUser.role === 'admin') {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <AdminDashboard />
        </main>
      </div>
    );
  }

  // Role: Student / Buyer (Mobile App Structure)
  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      <Navbar />
      <SidebarDrawer />

      <main className="flex-1">
        {currentTab === 'menu' && <MenuCatalog />}
        {currentTab === 'orders' && <OrderHistory />}
        {currentTab === 'payments' && <PaymentHistory />}
        {(currentTab === 'qr_history' || currentTab === 'qrs') && <QrHistory />}
        {currentTab === 'profile' && <UserProfile />}
      </main>

      {/* Mobile Bottom Navigation Bar for instant 1-thumb navigation */}
      <MobileBottomNav />

      {/* Global Modals */}
      <CartModal />
      <OrderQrModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
```

---

## 3. `src/components/buyer/MenuCatalog.jsx`
```jsx
import React, { useState } from 'react';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
import { MENU_ITEMS } from '../../types';
import { useApp } from '../../context/AppContext';

export const MenuCatalog = () => {
  const {
    cart,
    addToCart,
    setIsCartOpen,
    cartTotalQuantity,
    menuItems,
  } = useApp();
  const [imageErrors, setImageErrors] = useState({});

  const itemsToDisplay = menuItems && menuItems.length > 0 ? menuItems : MENU_ITEMS;

  const handleImageError = (id) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
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
                <div className="text-sm font-black">
                  {cartTotalQuantity} {cartTotalQuantity === 1 ? 'item' : 'items'} in cart
                </div>
                <div className="text-xs text-orange-100 font-medium">
                  Tap to review & checkout
                </div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## 4. `package.json`
```json
{
  "name": "campus-bite",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.1",
    "canvas-confetti": "^1.9.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "html5-qrcode": "^2.3.8",
    "jsqr": "^1.4.0",
    "lucide-react": "^0.344.0",
    "qrcode.react": "^3.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^6.4.3"
  }
}
```

---

## 5. `render.yaml`
```yaml
services:
  - type: web
    name: campus-bite
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```
