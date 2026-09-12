import React, { useState, Component } from 'react';
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
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      '🚨 [Deliz ErrorBoundary caught error]:',
      error?.message || error,
      '\n[Stack]:',
      error?.stack,
      '\n[ComponentStack]:',
      errorInfo?.componentStack
    );
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.removeItem('campus_bite_menu_items');
      localStorage.removeItem('campus_bite_cart');
      localStorage.removeItem('campus_bite_active_orders');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleFullClean = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-400 max-w-sm mb-6">
            We encountered a temporary rendering issue. Click below to reload Deliz smoothly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Deliz</span>
            </button>
            <button
              onClick={this.handleFullClean}
              className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-2xl text-xs transition active:scale-95"
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  const role = (typeof currentUser?.role === 'string' ? currentUser.role : 'student').toLowerCase();

  // Role: Vendor (vendor1 to vendor12, custom vendor usernames)
  if (role === 'vendor') {
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
  if (role === 'admin') {
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
        {currentTab === 'orders' ? (
          <OrderHistory />
        ) : currentTab === 'payments' ? (
          <PaymentHistory />
        ) : (currentTab === 'qr_history' || currentTab === 'qrs') ? (
          <QrHistory />
        ) : currentTab === 'profile' ? (
          <UserProfile />
        ) : (
          <MenuCatalog />
        )}
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
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
