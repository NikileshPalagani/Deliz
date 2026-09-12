import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { MENU_ITEMS, BLOCKS } from '../types';
import { getStoredUser, setStoredUser, getStoredCoins, setStoredCoins, getStoredOrders, setStoredOrders } from '../utils/storage';
import {
  subscribeToAuthChanges,
  signOutUser,
  getCurrentSession,
  loginUserApi,
  registerStudentApi,
  fetchUserProfileApi,
  updateProfileApi,
  resetPasswordWithToken,
  subscribeToStudentOrders,
  subscribeToVendorOrders,
  fetchStudentOrdersFromSupabase,
} from '../utils/supabaseClient';
import { apiFetch } from '../utils/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Current logged in user object: { role: 'student' | 'vendor' | 'admin', id, email, name, rollNo, phone, block, coins }
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [registeredVendors, setRegisteredVendors] = useState({});
  const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');

  // Dynamic menu items list
  const [menuItems, setMenuItems] = useState(() => {
    try {
      const saved = localStorage.getItem('campus_bite_menu_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return MENU_ITEMS.map(canonical => {
            const match = parsed.find(p => p && p.id === canonical.id);
            if (!match) return canonical;
            const price = (canonical.id === 'veg_puff' && match.price === 20) ? canonical.price : (match.price || canonical.price);
            return { ...canonical, ...match, price };
          });
        }
      }
    } catch {}
    return MENU_ITEMS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('campus_bite_menu_items', JSON.stringify(menuItems));
    } catch {}
  }, [menuItems]);

  const updateMenuItem = (itemId, updates) => {
    setMenuItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, ...updates } : item))
    );
  };

  // Active navigation tab
  const [currentTab, setCurrentTab] = useState('menu');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Cart state: { itemId: quantity }
  const [cart, setCart] = useState({});
  const [selectedBlock, setSelectedBlock] = useState('CB');
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);

  // Active Token QR Modal for student after payment
  const [activeQrOrder, setActiveQrOrder] = useState(null);

  // Orders list with immediate local cache restoration for zero-flicker UI
  const [orders, setOrders] = useState(() => {
    try {
      const user = getStoredUser();
      if (user?.email && user?.role === 'student') {
        const stored = getStoredOrders(user.email);
        return Array.isArray(stored) ? stored : [];
      }
    } catch (e) {}
    return [];
  });
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Sync user state cache for instant UI availability
  useEffect(() => {
    setStoredUser(currentUser);
  }, [currentUser]);

  // Load vendors list from backend
  const fetchVendors = async () => {
    try {
      const data = await apiFetch('/api/vendors');
      if (data.success && data.vendors) {
        const vendorMap = {};
        data.vendors.forEach(v => {
          vendorMap[v.username || v.vendorId] = v;
        });
        setRegisteredVendors(vendorMap);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Fetch Authoritative Coin Balance from PostgreSQL
  const syncAuthoritativeCoinBalance = async (email) => {
    if (!email) return;
    try {
      const data = await apiFetch('/api/coins/balance', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (data.success && typeof data.coins === 'number') {
        setCurrentUser(prev => prev && prev.email.toLowerCase() === email.toLowerCase() ? { ...prev, coins: data.coins } : prev);
        setStoredCoins(email, data.coins);
      }
    } catch (e) {}
  };

  // Fetch orders from backend with optimal role-scoped pagination and direct Supabase fallback
  const fetchOrders = useCallback(async (options = {}) => {
    try {
      setLoadingOrders(true);
      const email = currentUser?.email;
      const role = currentUser?.role;

      if (role === 'student' && email) {
        let fetchedOrders = null;
        try {
          const url = `/api/orders?email=${encodeURIComponent(email)}&limit=100`;
          const data = await apiFetch(url);
          if (data && data.success && Array.isArray(data.orders)) {
            fetchedOrders = data.orders;
          }
        } catch (backendErr) {
          console.warn('[ORDERS] Backend orders fetch note:', backendErr);
        }

        // Resilient fallback to direct Supabase PostgreSQL if backend network request failed or was empty
        if (!fetchedOrders || fetchedOrders.length === 0) {
          try {
            const directSupabaseOrders = await fetchStudentOrdersFromSupabase(email, 100);
            if (directSupabaseOrders && directSupabaseOrders.length > 0) {
              fetchedOrders = directSupabaseOrders;
            }
          } catch (supaErr) {
            console.warn('[ORDERS] Direct Supabase fetch note:', supaErr);
          }
        }

        if (fetchedOrders && Array.isArray(fetchedOrders)) {
          setOrders(fetchedOrders);
          setStoredOrders(email, fetchedOrders);
        }
        syncAuthoritativeCoinBalance(email);
      } else if (role === 'vendor') {
        const blockParam = options.block || selectedBlock;
        const url = `/api/orders?status=PENDING_PICKUP&block=${encodeURIComponent(blockParam)}&limit=50`;
        const data = await apiFetch(url);
        if (data && data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      } else if (role === 'admin') {
        const url = `/api/orders?limit=100`;
        const data = await apiFetch(url);
        if (data && data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [currentUser?.email, currentUser?.role, selectedBlock]);

  // ----------------------------------------------------
  // Event-Driven Realtime Order Subscription
  // ----------------------------------------------------
  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      return;
    }

    // Restore cached orders immediately when student logs in
    if (currentUser.role === 'student' && currentUser.email) {
      const cached = getStoredOrders(currentUser.email);
      if (cached && cached.length > 0) {
        setOrders(cached);
      }
    }

    // 1. Initial Load: Fetch current relevant orders once
    fetchOrders();

    let subscription = null;

    // 2. Realtime Subscription scoped to current user/role
    if (currentUser.role === 'student' && currentUser.email) {
      subscription = subscribeToStudentOrders(
        currentUser.email,
        (eventType, mappedNew, mappedOld) => {
          console.log(`📡 [REALTIME EVENT: ${eventType}] Student Order:`, mappedNew?.id || mappedOld?.id);
          if (eventType === 'INSERT' && mappedNew) {
            setOrders(prev => {
              const updated = [mappedNew, ...prev.filter(o => o.id !== mappedNew.id)];
              if (currentUser?.email) setStoredOrders(currentUser.email, updated);
              return updated;
            });
          } else if (eventType === 'UPDATE' && mappedNew) {
            setOrders(prev => {
              const updated = prev.map(o => o.id === mappedNew.id ? { ...o, ...mappedNew } : o);
              if (currentUser?.email) setStoredOrders(currentUser.email, updated);
              return updated;
            });
            setActiveQrOrder(prev => (prev && prev.id === mappedNew.id ? { ...prev, ...mappedNew } : prev));
            if (mappedNew.orderStatus === 'CLAIMED') {
              syncAuthoritativeCoinBalance(currentUser.email);
            }
          } else if (eventType === 'DELETE' && mappedOld) {
            setOrders(prev => {
              const updated = prev.filter(o => o.id !== mappedOld.id);
              if (currentUser?.email) setStoredOrders(currentUser.email, updated);
              return updated;
            });
          }
        },
        (status) => {
          setRealtimeStatus(status);
        }
      );
    } else if (currentUser.role === 'vendor') {
      subscription = subscribeToVendorOrders(
        currentUser.vendorId || currentUser.name,
        selectedBlock,
        (eventType, mappedNew, mappedOld) => {
          console.log(`📡 [REALTIME EVENT: ${eventType}] Vendor Order:`, mappedNew?.id || mappedOld?.id);
          if (eventType === 'INSERT' && mappedNew) {
            setOrders(prev => [mappedNew, ...prev.filter(o => o.id !== mappedNew.id)]);
          } else if (eventType === 'UPDATE' && mappedNew) {
            setOrders(prev => prev.map(o => o.id === mappedNew.id ? { ...o, ...mappedNew } : o));
          } else if (eventType === 'DELETE' && mappedOld) {
            setOrders(prev => prev.filter(o => o.id !== mappedOld.id));
          }
        },
        (status) => {
          setRealtimeStatus(status);
        }
      );
    }

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [currentUser?.email, currentUser?.role, selectedBlock]);

  // ----------------------------------------------------
  // Disconnected Fallback & Visibility Sync
  // ----------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;

    let fallbackTimer = null;
    let backoffDelay = 30000;

    const scheduleFallback = () => {
      fallbackTimer = setTimeout(async () => {
        if (realtimeStatus === 'DISCONNECTED' && currentUser) {
          console.log(`🔌 [REALTIME FALLBACK SYNC] Catch-up fetch (delay: ${backoffDelay}ms)`);
          await fetchOrders();
          backoffDelay = Math.min(backoffDelay * 1.5, 60000);
          scheduleFallback();
        }
      }, backoffDelay);
    };

    if (realtimeStatus === 'DISCONNECTED') {
      scheduleFallback();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        console.log('👁️ [TAB VISIBLE] Synchronizing order state once');
        fetchOrders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [realtimeStatus, currentUser?.email]);

  // Session Restoration & Supabase Auth State Change Listener
  useEffect(() => {
    const restoreSession = async () => {
      const session = await getCurrentSession();
      if (session?.user?.id) {
        const profileRes = await fetchUserProfileApi(session.user.id, session.user.email);
        if (profileRes.success && profileRes.user) {
          const u = profileRes.user;
          const role = (u.role || 'student').toLowerCase();
          setCurrentUser({ ...u, role });
        }
      }
    };
    restoreSession();

    const subscription = subscribeToAuthChanges(async (event, session) => {
      if (session?.user && (!currentUser || currentUser.email !== session.user.email)) {
        const profileRes = await fetchUserProfileApi(session.user.id, session.user.email);
        if (profileRes.success && profileRes.user) {
          const u = profileRes.user;
          const role = (u.role || 'student').toLowerCase();
          setCurrentUser({ ...u, role });
        }
      }
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------
  // Centralized Authentication Logic (Supabase Auth)
  // ----------------------------------------------------
  const loginUser = async (identifier, password) => {
    if (!identifier || !password) {
      return { success: false, error: 'Please enter your username/email and password.' };
    }

    const res = await loginUserApi(identifier, password);
    if (res.success && res.user) {
      const userRole = (res.user.role || 'student').toLowerCase();
      const normalizedUser = { ...res.user, role: userRole };
      setCurrentUser(normalizedUser);
      if (userRole === 'admin') {
        setCurrentTab('admin_stats');
      } else if (userRole === 'vendor') {
        setCurrentTab('scanner');
      } else {
        setCurrentTab('menu');
      }
      return { success: true, user: normalizedUser };
    }

    return { success: false, error: res.error || 'Invalid credentials.' };
  };

  // Centralized Student Registration
  const registerStudent = async ({ email, password, name, phone, rollNo, block = 'CB' }) => {
    const res = await registerStudentApi({
      email,
      password,
      name,
      phone,
      rollNo,
      block,
    });

    if (res.success && res.user) {
      setCurrentUser(res.user);
      setCurrentTab('menu');
      return { success: true, user: res.user };
    }

    return { success: false, error: res.error || 'Registration failed.' };
  };

  // Vendor Profile Update
  const updateVendorProfile = async ({ username, name, phone, stationName, upiId }) => {
    if (!currentUser || currentUser.role !== 'vendor') return { success: false, error: 'Unauthorized vendor session.' };

    const targetId = currentUser.username || currentUser.vendorId || currentUser.id;
    const res = await apiFetch('/api/vendors/update', {
      method: 'POST',
      body: JSON.stringify({
        vendorIdentifier: targetId,
        username,
        name,
        phone,
        stationName,
        upiId,
      }),
    });

    if (res.success && res.vendor) {
      const updated = { ...currentUser, ...res.vendor };
      setCurrentUser(updated);
      setStoredUser(updated);
      fetchVendors();
      return { success: true, vendor: updated };
    }

    return { success: false, error: res.error || 'Failed to update vendor profile.' };
  };

  // Create Vendor Account (Admin)
  const createVendor = async ({ username, password, name, phone, stationName, upiId, block }) => {
    const res = await apiFetch('/api/vendors/create', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        name,
        phone,
        stationName,
        upiId,
        block,
      }),
    });

    if (res.success && res.vendor) {
      fetchVendors();
      return { success: true, vendor: res.vendor };
    }

    return { success: false, error: res.error || 'Failed to create vendor account.' };
  };

  // Admin Update Vendor Username
  const adminUpdateVendorUsername = async (oldKey, newUsername) => {
    const res = await apiFetch('/api/vendors/update', {
      method: 'POST',
      body: JSON.stringify({
        vendorIdentifier: oldKey,
        username: newUsername,
      }),
    });

    if (res.success && res.vendor) {
      fetchVendors();
      if (currentUser?.role === 'vendor' && (currentUser.username === oldKey || currentUser.vendorId === oldKey)) {
        setCurrentUser(prev => ({ ...prev, ...res.vendor }));
      }
      return { success: true, vendor: res.vendor };
    }

    return { success: false, error: res.error || 'Failed to update vendor username.' };
  };

  // Logout
  const logout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentTab('menu');
    setCart({});
    setIsSidebarOpen(false);
    setIsCartOpen(false);
    setActiveQrOrder(null);
    setStoredUser(null);
  };

  // ----------------------------------------------------
  // Cart Actions
  // ----------------------------------------------------
  const addToCart = (itemId, qty = 1) => {
    setCart(prev => {
      const currentQty = prev[itemId] || 0;
      const newQty = currentQty + qty;
      if (newQty <= 0) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return { ...prev, [itemId]: newQty };
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  const clearCart = () => {
    setCart({});
    setCoinsToRedeem(0);
  };

  // Memoized Cart Calculations
  const cartItemsDetailed = useMemo(() => {
    if (!cart || typeof cart !== 'object') return [];
    return Object.entries(cart).map(([itemId, quantity]) => {
      const item = (menuItems || []).find(m => m && m.id === itemId) || MENU_ITEMS.find(m => m && m.id === itemId);
      if (!item || !quantity) return null;
      return {
        ...item,
        quantity: Number(quantity) || 1,
        subtotal: (item.price || 0) * (Number(quantity) || 1),
      };
    }).filter(Boolean);
  }, [cart, menuItems]);

  const cartTotalAmount = useMemo(() => {
    return cartItemsDetailed.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cartItemsDetailed]);

  const cartTotalQuantity = useMemo(() => {
    return cartItemsDetailed.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItemsDetailed]);

  // Coin Economy Rules:
  // 1. Value: 10 coins = ₹1 discount
  // 2. Earning: 1 coin for every ₹5 spent
  const userCoins = currentUser?.coins || 0;

  const maxRedeemableCoins = useMemo(() => {
    return Math.min(userCoins, cartTotalAmount * 10);
  }, [userCoins, cartTotalAmount]);

  const validCoinsRedeemed = useMemo(() => {
    return Math.min(coinsToRedeem, maxRedeemableCoins);
  }, [coinsToRedeem, maxRedeemableCoins]);

  const coinDiscountInRupees = useMemo(() => {
    return Math.floor(validCoinsRedeemed / 10);
  }, [validCoinsRedeemed]);

  const finalPayableAmount = useMemo(() => {
    return Math.max(0, cartTotalAmount - coinDiscountInRupees);
  }, [cartTotalAmount, coinDiscountInRupees]);

  const potentialCoinsEarned = useMemo(() => {
    return Math.floor(finalPayableAmount / 5);
  }, [finalPayableAmount]);

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#eab308', '#ec4899']
      });
    } catch (e) {}
  };

  // Place Order
  const createOrder = async (paymentDetails) => {
    try {
      const payload = {
        studentEmail: currentUser.email,
        studentName: currentUser.name,
        studentPhone: currentUser.phone,
        block: selectedBlock,
        items: cartItemsDetailed.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          isVeg: i.isVeg,
        })),
        totalAmount: cartTotalAmount,
        discount: coinDiscountInRupees,
        finalAmount: finalPayableAmount,
        coinsEarned: potentialCoinsEarned,
        coinsRedeemed: validCoinsRedeemed,
        paymentMethod: paymentDetails.method || 'UPI',
        transactionId: paymentDetails.transactionId || `TXN-${Date.now()}`
      };

      const data = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success) {
        const newCoinBalance = Math.max(0, userCoins - validCoinsRedeemed);
        setCurrentUser(prev => prev ? { ...prev, coins: newCoinBalance } : prev);
        setStoredCoins(currentUser.email, newCoinBalance);

        setOrders(prev => {
          const updated = [data.order, ...prev.filter(o => o.id !== data.order.id)];
          if (currentUser?.email) setStoredOrders(currentUser.email, updated);
          return updated;
        });
        clearCart();
        setIsCartOpen(false);
        setActiveQrOrder(data.order);
        triggerCelebration();

        return { success: true, order: data.order };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error('Order creation error:', err);
      return { success: false, message: 'Server error creating order.' };
    }
  };

  const fulfillVerifiedOrder = (order) => {
    if (!order) return;
    const newCoinBalance = Math.max(0, (currentUser?.coins || 0) - (order.coinsRedeemed || 0));
    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, coins: newCoinBalance } : prev);
      setStoredCoins(currentUser.email, newCoinBalance);
    }
    setOrders(prev => {
      const updated = [order, ...prev.filter(o => o.id !== order.id)];
      if (currentUser?.email) setStoredOrders(currentUser.email, updated);
      return updated;
    });
    clearCart();
    setIsCartOpen(false);
    setActiveQrOrder(order);
    triggerCelebration();
  };

  // Update Student Profile
  const updateProfile = async ({ name, phone, rollNo, block, password }) => {
    if (!currentUser) return { success: false, error: 'User is not logged in.' };

    const res = await updateProfileApi({
      userId: currentUser.id,
      email: currentUser.email,
      name,
      phone,
      rollNo,
      block,
      password,
    });

    if (res.success && res.user) {
      const updated = { ...currentUser, ...res.user };
      setCurrentUser(updated);
      setStoredUser(updated);
      return { success: true, user: updated };
    }

    return { success: false, error: res.error || 'Failed to update profile.' };
  };

  // Password Reset / Change
  const changePassword = async (email, newPassword, resetToken) => {
    if (!email || !newPassword) return { success: false, error: 'Email and new password are required.' };
    const res = await resetPasswordWithToken(email, resetToken, newPassword);
    return res;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentTab,
        setCurrentTab,
        isSidebarOpen,
        setIsSidebarOpen,
        isCartOpen,
        setIsCartOpen,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartItemsDetailed,
        cartTotalAmount,
        cartTotalQuantity,
        selectedBlock,
        setSelectedBlock,
        coinsToRedeem,
        setCoinsToRedeem,
        validCoinsRedeemed,
        coinDiscountInRupees,
        potentialCoinsEarned,
        maxRedeemableCoins,
        finalPayableAmount,
        activeQrOrder,
        setActiveQrOrder,
        orders,
        fetchOrders,
        loadingOrders,
        loginUser,
        registerStudent,
        logout,
        createOrder,
        fulfillVerifiedOrder,
        updateProfile,
        changePassword,
        updateVendorProfile,
        createVendor,
        adminUpdateVendorUsername,
        registeredVendors,
        setRegisteredVendors,
        menuItems,
        updateMenuItem,
        triggerCelebration,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
