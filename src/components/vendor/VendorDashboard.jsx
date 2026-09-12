import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Scan,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Search,
  User,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  ChefHat,
  PackageCheck,
  RefreshCw,
  Bell,
  SlidersHorizontal,
  DollarSign,
  Calendar,
  X,
  ChevronRight,
  Eye,
  Check,
  Timer,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QrScannerModal } from './QrScannerModal';
import { ScannedOrderResult } from './ScannedOrderResult';
import { apiFetch } from '../../utils/api';
import { subscribeToVendorOrders } from '../../utils/supabaseClient';

export const VendorDashboard = () => {
  const { currentUser, setCurrentTab, triggerCelebration } = useApp();

  // Navigation Tabs: 'overview' | 'queue' | 'scanner' | 'completed' | 'sales' | 'menu' | 'profile'
  const [activeTab, setActiveTab] = useState('overview');

  // Live Queue & Orders State
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState('ALL');
  const [filterBlock, setFilterBlock] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  // Modals & Selected Items
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Stats & Sales Data
  const [stats, setStats] = useState({
    newOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    completedToday: 0,
    todayOrders: 0,
    todaySales: 0,
    averagePrepTimeMinutes: 4.8,
    popularItems: [],
  });

  // Sales Tab State
  const [salesRange, setSalesRange] = useState('7d');
  const [salesData, setSalesData] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);

  // Menu Availability State
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);

  // Completed Orders Pagination
  const [completedOrders, setCompletedOrders] = useState([]);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedTotalPages, setCompletedTotalPages] = useState(1);
  const [completedDateFilter, setCompletedDateFilter] = useState('today');

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ----------------------------------------------------
  // 1. Data Fetching Functions
  // ----------------------------------------------------
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/vendor/stats');
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to fetch vendor stats:', err);
    }
  }, []);

  const fetchOrdersQueue = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterBlock === 'ALL'
        ? '/api/vendor/orders?limit=60'
        : `/api/vendor/orders?block=${encodeURIComponent(filterBlock)}&limit=60`;
      const res = await apiFetch(url);
      if (res && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to fetch vendor orders queue:', err);
    } finally {
      setLoading(false);
    }
  }, [filterBlock]);

  const fetchSalesData = useCallback(async (range = '7d') => {
    try {
      setSalesLoading(true);
      const res = await apiFetch(`/api/vendor/sales?range=${range}`);
      if (res && res.sales) {
        setSalesData(res.sales);
      }
    } catch (err) {
      console.error('Failed to fetch vendor sales analytics:', err);
    } finally {
      setSalesLoading(false);
    }
  }, []);

  const fetchVendorMenu = useCallback(async () => {
    try {
      setMenuLoading(true);
      const res = await apiFetch('/api/vendor/menu');
      if (res && res.items) {
        setMenuItems(res.items);
      }
    } catch (err) {
      console.error('Failed to fetch vendor menu:', err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const fetchCompletedOrders = useCallback(async () => {
    try {
      let startDate = null;
      const today = new Date().toISOString().split('T')[0];
      if (completedDateFilter === 'today') {
        startDate = today;
      } else if (completedDateFilter === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        startDate = d.toISOString().split('T')[0];
      } else if (completedDateFilter === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
      }

      let url = `/api/vendor/orders?orderStatus=CLAIMED&page=${completedPage}&limit=15`;
      if (startDate) url += `&startDate=${startDate}`;
      if (filterBlock !== 'ALL') url += `&block=${encodeURIComponent(filterBlock)}`;

      const res = await apiFetch(url);
      if (res && res.orders) {
        setCompletedOrders(res.orders);
        if (res.pagination) {
          setCompletedTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch completed orders:', err);
    }
  }, [completedPage, completedDateFilter, filterBlock]);

  // ----------------------------------------------------
  // 2. Lifecycle & Realtime Subscription
  // ----------------------------------------------------
  useEffect(() => {
    fetchStats();
    fetchOrdersQueue();

    const subscription = subscribeToVendorOrders(
      currentUser?.vendorId || currentUser?.username || currentUser?.name,
      filterBlock,
      (eventType, mappedNew, mappedOld) => {
        if (eventType === 'INSERT' && mappedNew) {
          setOrders(prev => [mappedNew, ...prev.filter(o => o.id !== mappedNew.id)]);
          setNewOrderAlert(true);
          showToast(`🔔 New Order #${mappedNew.id} placed!`, 'info');
          fetchStats();
        } else if (eventType === 'UPDATE' && mappedNew) {
          setOrders(prev => prev.map(o => o.id === mappedNew.id ? { ...o, ...mappedNew } : o));
          fetchStats();
        } else if (eventType === 'DELETE' && mappedOld) {
          setOrders(prev => prev.filter(o => o.id !== mappedOld.id));
          fetchStats();
        }
      },
      (status) => {
        setRealtimeStatus(status);
      }
    );

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [currentUser?.vendorId, currentUser?.username, currentUser?.name, filterBlock, fetchStats, fetchOrdersQueue]);

  // Tab change triggers specific data load
  useEffect(() => {
    if (activeTab === 'sales') fetchSalesData(salesRange);
    if (activeTab === 'menu') fetchVendorMenu();
    if (activeTab === 'completed') fetchCompletedOrders();
  }, [activeTab, salesRange, fetchSalesData, fetchVendorMenu, fetchCompletedOrders]);

  // ----------------------------------------------------
  // 3. Status Transition Handler
  // ----------------------------------------------------
  const handleStatusTransition = async (orderId, targetStatus) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await apiFetch(`/api/vendor/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: targetStatus })
      });

      if (res && res.success) {
        showToast(`Order #${orderId} marked as ${targetStatus}!`);
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: targetStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, orderStatus: targetStatus }));
        }
        fetchStats();
      } else {
        showToast(res?.error || 'Failed to update order status.', 'error');
      }
    } catch (err) {
      console.error('Status transition error:', err);
      showToast('Connection error updating order.', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // ----------------------------------------------------
  // 4. Menu Availability Toggle
  // ----------------------------------------------------
  const handleToggleMenuAvailability = async (itemId, currentAvailability) => {
    try {
      const res = await apiFetch(`/api/vendor/menu/${itemId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !currentAvailability })
      });
      if (res && res.success) {
        setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, isAvailable: !currentAvailability } : i));
        showToast(`Item availability updated to ${!currentAvailability ? 'In Stock' : 'Out of Stock'}.`);
      } else {
        showToast('Failed to toggle item.', 'error');
      }
    } catch (e) {
      showToast('Server error updating item.', 'error');
    }
  };

  // ----------------------------------------------------
  // 5. QR Scan Verification Handler
  // ----------------------------------------------------
  const handleScanSuccess = async (scannedRawText) => {
    setIsScannerOpen(false);
    try {
      const cleanRaw = (scannedRawText || '').trim();
      let orderId = cleanRaw;
      let token = cleanRaw;

      if (cleanRaw.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanRaw);
          if (parsed.id) orderId = parsed.id;
          if (parsed.token) token = parsed.token;
        } catch (_) {}
      }

      if (cleanRaw.startsWith('CB-TOKEN-')) {
        token = cleanRaw;
        const parts = cleanRaw.split('-');
        if (parts.length >= 4 && parts[2]?.startsWith('CB')) {
          orderId = `${parts[2]}-${parts[3]}`;
        }
      }

      const res = await apiFetch('/api/orders/claim', {
        method: 'POST',
        headers: {
          'x-vendor-id': currentUser?.vendorId || currentUser?.username || currentUser?.email || '',
        },
        body: JSON.stringify({
          orderId: orderId !== token ? orderId : undefined,
          token,
          vendorId: currentUser?.vendorId || currentUser?.username || currentUser?.name || 'Vendor',
        })
      });

      if (res.order || res.alreadyClaimed) {
        setScanResult(res);
      } else {
        showToast(res.message || 'QR code not recognized or invalid pickup pass.', 'error');
      }
      fetchOrdersQueue();
      fetchStats();
    } catch (err) {
      console.error('Scan claim error:', err);
      showToast('Failed to connect to verification server.', 'error');
    }
  };

  // ----------------------------------------------------
  // 6. Filtered Queue Calculations
  // ----------------------------------------------------
  const filteredQueueOrders = useMemo(() => {
    return orders.filter(o => {
      // Status filtering
      if (queueStatusFilter === 'NEW' && !['PLACED', 'NEW', 'PENDING_PICKUP'].includes(o.orderStatus)) return false;
      if (queueStatusFilter === 'PREPARING' && o.orderStatus !== 'PREPARING') return false;
      if (queueStatusFilter === 'READY' && o.orderStatus !== 'READY') return false;
      if (queueStatusFilter === 'CLAIMED' && o.orderStatus !== 'CLAIMED') return false;
      if (queueStatusFilter === 'CANCELLED' && o.orderStatus !== 'CANCELLED') return false;

      // Block filter
      if (filterBlock !== 'ALL' && o.block !== filterBlock) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (o.id && o.id.toLowerCase().includes(q)) ||
          (o.token && o.token.toLowerCase().includes(q)) ||
          (o.studentName && o.studentName.toLowerCase().includes(q)) ||
          (o.studentEmail && o.studentEmail.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [orders, queueStatusFilter, filterBlock, searchQuery]);

  const activeWorkloadCount = useMemo(() => {
    return orders.filter(o => ['PLACED', 'NEW', 'PENDING_PICKUP', 'PREPARING', 'READY'].includes(o.orderStatus)).length;
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 pt-4 sm:pt-6 animate-in fade-in">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 animate-in slide-in-from-top-3">
          <div className={`px-4 py-3 rounded-2xl border shadow-2xl flex items-center gap-2.5 text-xs font-bold ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-950/90 border-blue-700 text-blue-200'
              : 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
          }`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : toastMessage.type === 'info' ? (
              <Bell className="w-4 h-4 text-blue-400 animate-bounce" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header Station Banner */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-glow">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {currentUser?.name || 'Food Counter Station'}
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                Online
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>Station: <strong className="text-gray-200">@{currentUser?.username || currentUser?.vendorId}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${realtimeStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                Realtime {realtimeStatus === 'CONNECTED' ? 'Live' : 'Standby'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-5 py-3 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-orange-500/20 transition flex items-center gap-2 active:scale-95 min-h-[44px]"
          >
            <Scan className="w-4 h-4" />
            <span>Launch QR Scanner</span>
          </button>

          <button
            onClick={() => {
              fetchStats();
              fetchOrdersQueue();
              showToast('Refreshed orders and telemetry.');
            }}
            className="p-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded-2xl transition active:scale-95"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'queue', label: `Live Queue (${activeWorkloadCount})`, icon: Clock, badge: newOrderAlert },
          { id: 'completed', label: 'Completed', icon: PackageCheck },
          { id: 'sales', label: 'Sales & Trends', icon: DollarSign },
          { id: 'menu', label: 'Menu Availability', icon: UtensilsCrossed },
          { id: 'profile', label: 'Station Settings', icon: User },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'queue') setNewOrderAlert(false);
              }}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 border border-orange-400/50'
                  : 'bg-[#111827] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================== */}
      {/* TAB 1: OVERVIEW & TELEMETRY */}
      {/* ==================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>New / Placed</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 mt-2">
                {stats.newOrders || 0}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">Awaiting prep</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>Preparing</span>
                <ChefHat className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="text-2xl font-black text-orange-400 mt-2">
                {stats.preparingOrders || 0}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">On the grill</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>Ready</span>
                <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                {stats.readyOrders || 0}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">At pickup desk</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">
                {stats.completedToday || 0}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">Fulfilled today</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>Today's Sales</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 mt-2">
                ₹{stats.todaySales || 0}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{stats.todayOrders || 0} orders</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center justify-between">
                <span>Avg Prep Time</span>
                <Timer className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-400 mt-2">
                {stats.averagePrepTimeMinutes || 4.8}m
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">Speed velocity</div>
            </div>
          </div>

          {/* Quick Actions & Recent Stream Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Incoming Feed Preview */}
            <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span>Incoming Workload Stream</span>
                </h3>
                <button
                  onClick={() => setActiveTab('queue')}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <span>View All Queue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No active orders in queue right now. Counter is all clear!
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map(o => (
                    <div
                      key={o.id}
                      className="bg-gray-900/90 border border-gray-800 rounded-2xl p-3.5 flex items-center justify-between hover:border-gray-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-xs text-orange-400">
                          #{o.id}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span>{o.studentName}</span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-gray-800 text-gray-300 font-mono">
                              {o.block} Block
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                            {o.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          o.orderStatus === 'PREPARING'
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            : o.orderStatus === 'READY'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {o.orderStatus}
                        </span>
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="p-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Popular Items Card */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Today's Top Velocity Items</span>
                </h3>

                {stats.popularItems && stats.popularItems.length > 0 ? (
                  <div className="space-y-3">
                    {stats.popularItems.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-gray-200">{item.item_name || item.name}</span>
                        </div>
                        <span className="font-black text-orange-400 px-2 py-0.5 rounded-lg bg-black/40 border border-gray-800">
                          {item.total_quantity || item.quantity} sold
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-8 text-center">
                    Top item analytics will refresh after rush orders.
                  </div>
                )}
              </div>

              {/* Quick Launch Scanner Card */}
              <div className="mt-6 pt-4 border-t border-gray-800/80">
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Scan className="w-4 h-4" />
                  <span>Verify Student QR Pass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: LIVE ORDER QUEUE & WORKFLOW */}
      {/* ==================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: 'All Orders' },
                { id: 'NEW', label: 'New / Placed' },
                { id: 'PREPARING', label: 'Preparing' },
                { id: 'READY', label: 'Ready for Pickup' },
                { id: 'CLAIMED', label: 'Claimed' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setQueueStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    queueStatusFilter === st.id
                      ? 'bg-orange-500 text-white shadow'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Search & Block Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search order or student..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <select
                value={filterBlock}
                onChange={e => setFilterBlock(e.target.value)}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Blocks</option>
                <option value="CB">CB</option>
                <option value="CM">CM</option>
                <option value="FB">FB</option>
                <option value="PG">PG</option>
              </select>
            </div>
          </div>

          {/* Orders Cards Grid */}
          {loading ? (
            <div className="py-16 text-center text-gray-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-400" />
              Loading vendor order queue...
            </div>
          ) : filteredQueueOrders.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-12 text-center text-gray-500">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <div className="text-sm font-bold text-gray-300">No orders matching filter</div>
              <p className="text-xs text-gray-500 mt-1">Check back as new orders arrive from campus blocks.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQueueOrders.map(order => {
                const isNew = ['PLACED', 'NEW', 'PENDING_PICKUP'].includes(order.orderStatus);
                const isPreparing = order.orderStatus === 'PREPARING';
                const isReady = order.orderStatus === 'READY';
                const isClaimed = order.orderStatus === 'CLAIMED';
                const isCancelled = order.orderStatus === 'CANCELLED';

                return (
                  <div
                    key={order.id}
                    className={`bg-[#111827] border rounded-3xl p-4 shadow-card-dark flex flex-col justify-between transition ${
                      isPreparing
                        ? 'border-orange-500/50'
                        : isReady
                        ? 'border-emerald-500/50'
                        : isClaimed
                        ? 'border-gray-800 opacity-80'
                        : 'border-gray-800'
                    }`}
                  >
                    <div>
                      {/* Header Row */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-orange-400">
                            #{order.id}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-gray-300">
                            {order.block} Block
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                          isPreparing
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            : isReady
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : isClaimed
                            ? 'bg-gray-800 text-gray-400 border-gray-700'
                            : isCancelled
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {order.orderStatus}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div className="text-xs font-bold text-white mb-2">
                        {order.studentName}
                        <span className="text-[11px] font-normal text-gray-400 ml-1.5">
                          ({order.studentEmail})
                        </span>
                      </div>

                      {/* Food Items Box */}
                      <div className="bg-gray-900/90 border border-gray-800/80 rounded-2xl p-3 mb-3 space-y-1.5">
                        {order.items?.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-gray-200 font-medium">
                              <strong className="text-orange-400 font-bold">{it.quantity}x</strong> {it.name}
                            </span>
                            <span className="text-gray-400 font-mono">₹{(it.price || 0) * (it.quantity || 1)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Price & Time */}
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-3 px-1">
                        <span>Total: <strong className="text-white text-sm">₹{order.finalAmount}</strong></span>
                        <span className="text-[11px]">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>

                    {/* Action Buttons Workflow */}
                    <div className="pt-3 border-t border-gray-800/80 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition"
                        title="View Full Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isNew && (
                        <button
                          onClick={() => handleStatusTransition(order.id, 'PREPARING')}
                          disabled={updatingOrderId === order.id}
                          className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Start Preparing</span>
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleStatusTransition(order.id, 'READY')}
                          disabled={updatingOrderId === order.id}
                          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Mark Ready</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleScanSuccess(order.token || order.id)}
                          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Scan className="w-3.5 h-3.5" />
                          <span>Quick Handover</span>
                        </button>
                      )}

                      {isClaimed && (
                        <div className="flex-1 text-center py-2 text-[11px] font-bold text-gray-500 bg-gray-900 rounded-xl">
                          Fulfilled at {order.claimedAt ? new Date(order.claimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'counter'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: COMPLETED ORDERS HISTORY */}
      {/* ==================================================== */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {/* Filter Header */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Date Range:</span>
              {['today', 'yesterday', '7d', 'all'].map(d => (
                <button
                  key={d}
                  onClick={() => {
                    setCompletedDateFilter(d);
                    setCompletedPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition ${
                    completedDateFilter === d
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={fetchCompletedOrders}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh History</span>
            </button>
          </div>

          {/* Completed Table / Cards */}
          {completedOrders.length === 0 ? (
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-12 text-center text-gray-500">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <div className="text-sm font-bold text-gray-300">No completed orders found for this timeframe</div>
            </div>
          ) : (
            <div className="bg-[#111827] border border-gray-800 rounded-3xl overflow-hidden shadow-card-dark divide-y divide-gray-800/80">
              {completedOrders.map(order => (
                <div key={order.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-900/50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-orange-400">#{order.id}</span>
                      <span className="text-xs font-bold text-white">{order.studentName}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-gray-900 text-gray-400 font-mono">
                        {order.block}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="font-bold text-white">₹{order.finalAmount}</div>
                      <div className="text-[10px] text-gray-500">
                        {order.claimedAt ? new Date(order.claimedAt).toLocaleString() : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {completedTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                disabled={completedPage === 1}
                className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-300 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400 font-mono">
                Page {completedPage} of {completedTotalPages}
              </span>
              <button
                onClick={() => setCompletedPage(p => Math.min(completedTotalPages, p + 1))}
                disabled={completedPage >= completedTotalPages}
                className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: SALES ANALYTICS & VELOCITY */}
      {/* ==================================================== */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Counter Sales & Revenue</span>
            </h3>

            <div className="flex items-center gap-1.5">
              {['1d', '7d', '30d'].map(r => (
                <button
                  key={r}
                  onClick={() => setSalesRange(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition ${
                    salesRange === r
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                  }`}
                >
                  {r === '1d' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Sales Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="text-xs font-bold text-gray-400 uppercase">Total Revenue</div>
              <div className="text-3xl font-black text-emerald-400 mt-2">
                ₹{salesData?.totalRevenue || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Settled canteen turnover</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="text-xs font-bold text-gray-400 uppercase">Orders Handed Over</div>
              <div className="text-3xl font-black text-white mt-2">
                {salesData?.totalOrders || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Verified via QR scan</div>
            </div>

            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="text-xs font-bold text-gray-400 uppercase">Average Order Value</div>
              <div className="text-3xl font-black text-blue-400 mt-2">
                ₹{salesData?.averageOrderValue || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">Spend per student pickup</div>
            </div>
          </div>

          {/* Daily Trends Breakdown */}
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Daily Sales Velocity ({salesRange})
            </h4>

            {salesData?.dailyTrends && salesData.dailyTrends.length > 0 ? (
              <div className="space-y-3">
                {salesData.dailyTrends.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-900/70 p-3 rounded-2xl border border-gray-800">
                    <span className="font-bold text-gray-200">{d.date}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 font-mono">{d.orders} orders</span>
                      <span className="font-black text-emerald-400 font-mono">₹{d.revenue}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 text-xs">
                No finalized sales records for this date window.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: MENU AVAILABILITY TOGGLING */}
      {/* ==================================================== */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-orange-400" />
                <span>Station Food Item Availability</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Toggle items out of stock during sudden demand surges. Students see updates instantly.
              </p>
            </div>

            <button
              onClick={fetchVendorMenu}
              className="p-2.5 bg-gray-900 border border-gray-700 text-gray-300 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {menuLoading ? (
            <div className="py-16 text-center text-gray-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-400" />
              Loading food catalog...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map(item => {
                const isAvail = item.isAvailable !== false && item.is_available !== false;
                return (
                  <div
                    key={item.id}
                    className={`bg-[#111827] border rounded-3xl p-4 shadow-card-dark flex items-center justify-between gap-3 transition ${
                      isAvail ? 'border-gray-800' : 'border-rose-900/50 bg-rose-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shrink-0">
                        <img
                          src={item.image || item.image_url || '/images/samosa.png'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/images/samosa.png'; }}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <span className={`w-2 h-2 rounded-full ${item.isVeg || item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="text-xs font-extrabold text-orange-400 mt-0.5">
                          ₹{item.price}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleMenuAvailability(item.id, isAvail)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 ${
                        isAvail
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                      }`}
                    >
                      {isAvail ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>In Stock</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Out of Stock</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 6: VENDOR PROFILE & SETTINGS */}
      {/* ==================================================== */}
      {activeTab === 'profile' && (
        <div className="max-w-xl mx-auto bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-card-dark space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-glow">
              <Store className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{currentUser?.name}</h2>
              <p className="text-xs text-gray-400">Station Terminal @{currentUser?.username || currentUser?.vendorId}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-800 text-xs">
            <div className="flex justify-between py-2 border-b border-gray-800/60">
              <span className="text-gray-400">Terminal Role:</span>
              <span className="font-bold text-orange-400 uppercase">Canteen Counter Vendor</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800/60">
              <span className="text-gray-400">Authorized Phone:</span>
              <span className="font-bold text-white">{currentUser?.phone || '+91 9876543210'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800/60">
              <span className="text-gray-400">Assigned Station:</span>
              <span className="font-bold text-white">{currentUser?.stationName || 'Counter 1 - Main Canteen'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800/60">
              <span className="text-gray-400">Status:</span>
              <span className="font-bold text-emerald-400">Active / Operational</span>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setCurrentTab('profile')}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white rounded-2xl font-bold text-xs transition"
            >
              Edit Station Profile & Credentials
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ORDER DETAILS MODAL */}
      {/* ==================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-gray-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white font-mono">
                  Order #{selectedOrder.id}
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                  {selectedOrder.orderStatus}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Placed at {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : ''}
              </p>
            </div>

            {/* Customer Box */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3.5 space-y-1.5 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Customer:</span>
                <span className="font-bold text-white">{selectedOrder.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="font-mono text-gray-300">{selectedOrder.studentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Delivery Block:</span>
                <span className="font-bold text-orange-400">{selectedOrder.block} Block</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Payment Status:</span>
                <span className="font-bold text-emerald-400 uppercase">{selectedOrder.paymentStatus || 'PAID'}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 mb-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase">Items to Dispense:</h4>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800">
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white">{it.name}</span>
                    </div>
                    <span className="font-black text-orange-400 px-2.5 py-1 rounded-xl bg-black/50 border border-gray-800">
                      x{it.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex items-center justify-between p-3.5 bg-gray-900/60 rounded-2xl border border-gray-800 text-xs font-bold mb-5">
              <span>Total Payable Amount:</span>
              <span className="text-base text-orange-400">₹{selectedOrder.finalAmount}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {['PLACED', 'NEW', 'PENDING_PICKUP'].includes(selectedOrder.orderStatus) && (
                <button
                  onClick={() => handleStatusTransition(selectedOrder.id, 'PREPARING')}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-xs shadow"
                >
                  Start Preparing
                </button>
              )}
              {selectedOrder.orderStatus === 'PREPARING' && (
                <button
                  onClick={() => handleStatusTransition(selectedOrder.id, 'READY')}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-xs shadow"
                >
                  Mark as Ready
                </button>
              )}
              {selectedOrder.orderStatus === 'READY' && (
                <button
                  onClick={() => {
                    handleScanSuccess(selectedOrder.token || selectedOrder.id);
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow"
                >
                  Verify & Handover Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Camera Scanner Dialog */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Scanned Result Dialog */}
      <ScannedOrderResult
        result={scanResult}
        onClose={() => setScanResult(null)}
        onOrderClaimed={() => {
          fetchOrdersQueue();
          fetchStats();
        }}
      />

    </div>
  );
};
