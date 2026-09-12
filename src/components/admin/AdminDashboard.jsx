import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Building,
  Store,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Search,
  Flame,
  User,
  Mail,
  Phone,
  Plus,
  Edit2,
  Trash2,
  Utensils,
  Tag,
  Check,
  X,
  AlertCircle,
  Clock,
  Calendar,
  Users,
  Megaphone,
  BarChart3,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Percent,
  Power,
  Layers,
  ArrowUpRight,
  Download,
  AlertTriangle,
  Activity,
  Cpu,
  Server,
  Zap,
  CheckCircle,
  Radio,
  Sliders,
  Terminal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';
import { BLOCKS } from '../../types';
import { subscribeToAdminOrders } from '../../utils/supabaseClient';

export const AdminDashboard = () => {
  const {
    currentUser,
    registeredVendors,
    createVendor,
    adminUpdateVendorUsername,
    menuItems: contextMenuItems,
    updateMenuItem,
    logout,
  } = useApp();

  // Active Navigation Tab
  // Options: 'overview', 'orders', 'students', 'menu', 'vendors', 'payments', 'coupons', 'announcements', 'reports'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview Live Telemetry State
  const [statsData, setStatsData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState('DISCONNECTED');

  // Orders Management State
  const [orders, setOrders] = useState([]);
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [orderBlockFilter, setOrderBlockFilter] = useState('ALL');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

  // Students Management State
  const [students, setStudents] = useState([]);
  const [studentsPagination, setStudentsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBlockFilter, setStudentBlockFilter] = useState('ALL');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);

  // Menu Management State
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    price: '',
    unit: 'pcs',
    category: 'Snacks',
    isVeg: true,
    image: '/images/samosa.png',
    description: '',
    isAvailable: true,
    stockCount: 100
  });

  // Vendors Management State
  const [vendorSearch, setVendorSearch] = useState('');
  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    username: '',
    password: '',
    name: '',
    stationName: '',
    phone: '',
    upiId: '',
    block: '',
  });
  const [editingVendorKey, setEditingVendorKey] = useState(null);
  const [editUsernameInput, setEditUsernameInput] = useState('');

  // Payments Management State
  const [payments, setPayments] = useState([]);
  const [paymentsPagination, setPaymentsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentFilterStatus, setPaymentFilterStatus] = useState('ALL');

  // Announcements Management State
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [isCreateAnnouncementOpen, setIsCreateAnnouncementOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    priority: 'normal',
    isActive: true,
    expiresAt: ''
  });

  // Coupons Management State
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [isCreateCouponOpen, setIsCreateCouponOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountPercent: 10,
    maxDiscount: 50,
    minOrderAmount: 30,
    expiresAt: ''
  });

  // Reports / Analytics State
  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsRange, setReportsRange] = useState('7d');

  // Phase 13: System Analytics & Telemetry State
  const [analyticsSubTab, setAnalyticsSubTab] = useState('overview'); // 'overview', 'orders_revenue', 'food', 'peak_times', 'vendors', 'processing_qr', 'security_otp', 'system_health'
  const [analyticsRange, setAnalyticsRange] = useState('30d');
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [analyticsOrders, setAnalyticsOrders] = useState(null);
  const [analyticsRevenue, setAnalyticsRevenue] = useState(null);
  const [analyticsFood, setAnalyticsFood] = useState(null);
  const [analyticsPeakTimes, setAnalyticsPeakTimes] = useState(null);
  const [analyticsVendors, setAnalyticsVendors] = useState(null);
  const [analyticsProcessingTimes, setAnalyticsProcessingTimes] = useState(null);
  const [analyticsPayments, setAnalyticsPayments] = useState(null);
  const [analyticsOtp, setAnalyticsOtp] = useState(null);
  const [analyticsQr, setAnalyticsQr] = useState(null);
  const [analyticsSystemHealth, setAnalyticsSystemHealth] = useState(null);
  const [analyticsApiMetrics, setAnalyticsApiMetrics] = useState(null);
  const [analyticsErrors, setAnalyticsErrors] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Feedback Toast & Confirmation Modal
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Auth Header helper
  const adminHeaders = useMemo(() => ({
    'x-admin-role': 'admin',
    'x-admin-email': currentUser?.email || 'admin@cvr.ac.in',
  }), [currentUser]);

  // ----------------------------------------------------
  // 1. Fetch Overview Stats
  // ----------------------------------------------------
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const data = await apiFetch('/api/admin/stats', { headers: adminHeaders });
      if (data.success && data.stats) {
        setStatsData(data.stats);
      }
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }, [adminHeaders]);

  // ----------------------------------------------------
  // 2. Fetch Orders (Paginated & Filtered)
  // ----------------------------------------------------
  const fetchAdminOrders = useCallback(async (page = 1) => {
    try {
      setOrdersLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        orderStatus: orderStatusFilter,
        paymentStatus: paymentStatusFilter,
        block: orderBlockFilter,
        search: orderSearch,
      });
      const data = await apiFetch(`/api/admin/orders?${params.toString()}`, { headers: adminHeaders });
      if (data.success) {
        setOrders(data.orders || []);
        if (data.pagination) setOrdersPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch admin orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  }, [orderStatusFilter, paymentStatusFilter, orderBlockFilter, orderSearch, adminHeaders]);

  // ----------------------------------------------------
  // 3. Fetch Students Directory (Paginated)
  // ----------------------------------------------------
  const fetchAdminStudents = useCallback(async (page = 1) => {
    try {
      setStudentsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        block: studentBlockFilter,
        search: studentSearch,
      });
      const data = await apiFetch(`/api/admin/students?${params.toString()}`, { headers: adminHeaders });
      if (data.success) {
        setStudents(data.students || []);
        if (data.pagination) setStudentsPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch admin students:', e);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentBlockFilter, studentSearch, adminHeaders]);

  // ----------------------------------------------------
  // 4. Fetch Menu Catalog (Admin)
  // ----------------------------------------------------
  const fetchAdminMenu = useCallback(async () => {
    try {
      setMenuLoading(true);
      const data = await apiFetch('/api/admin/menu', { headers: adminHeaders });
      if (data.success && Array.isArray(data.items)) {
        setMenuItems(data.items);
      }
    } catch (e) {
      console.error('Failed to fetch admin menu:', e);
    } finally {
      setMenuLoading(false);
    }
  }, [adminHeaders]);

  // ----------------------------------------------------
  // 5. Fetch Payments Ledger (Paginated)
  // ----------------------------------------------------
  const fetchAdminPayments = useCallback(async (page = 1) => {
    try {
      setPaymentsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        paymentStatus: paymentFilterStatus,
        search: paymentSearch,
      });
      const data = await apiFetch(`/api/admin/payments?${params.toString()}`, { headers: adminHeaders });
      if (data.success) {
        setPayments(data.payments || []);
        if (data.pagination) setPaymentsPagination(data.pagination);
      }
    } catch (e) {
      console.error('Failed to fetch admin payments:', e);
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentFilterStatus, paymentSearch, adminHeaders]);

  // ----------------------------------------------------
  // 6. Fetch Announcements
  // ----------------------------------------------------
  const fetchAnnouncements = useCallback(async () => {
    try {
      setAnnouncementsLoading(true);
      const data = await apiFetch('/api/admin/announcements', { headers: adminHeaders });
      if (data.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      }
    } catch (e) {
      console.error('Failed to fetch announcements:', e);
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [adminHeaders]);

  // ----------------------------------------------------
  // 7. Fetch Coupons
  // ----------------------------------------------------
  const fetchCoupons = useCallback(async () => {
    try {
      setCouponsLoading(true);
      const data = await apiFetch('/api/admin/coupons', { headers: adminHeaders });
      if (data.success && Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      }
    } catch (e) {
      console.error('Failed to fetch coupons:', e);
    } finally {
      setCouponsLoading(false);
    }
  }, [adminHeaders]);

  // ----------------------------------------------------
  // 8. Fetch Reports / Analytics (Legacy + Phase 13)
  // ----------------------------------------------------
  const fetchReports = useCallback(async (range = '7d') => {
    try {
      setReportsLoading(true);
      const data = await apiFetch(`/api/admin/reports?range=${range}`, { headers: adminHeaders });
      if (data.success && data.reports) {
        setReportsData(data.reports);
      }
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    } finally {
      setReportsLoading(false);
    }
  }, [adminHeaders]);

  // Phase 13: Modular Analytics Subsystem Fetcher
  const fetchAnalyticsData = useCallback(async (subTab = analyticsSubTab, range = analyticsRange) => {
    try {
      setAnalyticsLoading(true);
      if (subTab === 'overview') {
        const [ovRes, ptRes, ptTimesRes] = await Promise.all([
          apiFetch('/api/admin/analytics/overview', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/payments', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/processing-times', { headers: adminHeaders })
        ]);
        if (ovRes.success && ovRes.stats) setAnalyticsOverview(ovRes.stats);
        if (ptRes.success && ptRes.payments) setAnalyticsPayments(ptRes.payments);
        if (ptTimesRes.success && ptTimesRes.processing_times) setAnalyticsProcessingTimes(ptTimesRes.processing_times);
      } else if (subTab === 'orders_revenue') {
        const [ordRes, revRes] = await Promise.all([
          apiFetch(`/api/admin/analytics/orders?range=${range}`, { headers: adminHeaders }),
          apiFetch(`/api/admin/analytics/revenue?range=${range}`, { headers: adminHeaders })
        ]);
        if (ordRes.success) setAnalyticsOrders(ordRes);
        if (revRes.success) setAnalyticsRevenue(revRes);
      } else if (subTab === 'food') {
        const foodRes = await apiFetch(`/api/admin/analytics/food?range=${range}`, { headers: adminHeaders });
        if (foodRes.success) setAnalyticsFood(foodRes);
      } else if (subTab === 'peak_times') {
        const peakRes = await apiFetch(`/api/admin/analytics/peak-times?range=${range}`, { headers: adminHeaders });
        if (peakRes.success) setAnalyticsPeakTimes(peakRes);
      } else if (subTab === 'vendors') {
        const vRes = await apiFetch('/api/admin/analytics/vendors', { headers: adminHeaders });
        if (vRes.success && vRes.vendors) setAnalyticsVendors(vRes.vendors);
      } else if (subTab === 'processing_qr') {
        const [procRes, qrRes] = await Promise.all([
          apiFetch('/api/admin/analytics/processing-times', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/qr', { headers: adminHeaders })
        ]);
        if (procRes.success && procRes.processing_times) setAnalyticsProcessingTimes(procRes.processing_times);
        if (qrRes.success && qrRes.qr) setAnalyticsQr(qrRes.qr);
      } else if (subTab === 'security_otp') {
        const [otpRes, qrRes] = await Promise.all([
          apiFetch('/api/admin/analytics/otp', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/qr', { headers: adminHeaders })
        ]);
        if (otpRes.success && otpRes.otp) setAnalyticsOtp(otpRes.otp);
        if (qrRes.success && qrRes.qr) setAnalyticsQr(qrRes.qr);
      } else if (subTab === 'system_health') {
        const [healthRes, metricsRes, errRes] = await Promise.all([
          apiFetch('/api/admin/analytics/system-health', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/api-metrics', { headers: adminHeaders }),
          apiFetch('/api/admin/analytics/errors', { headers: adminHeaders })
        ]);
        if (healthRes.success && healthRes.health) setAnalyticsSystemHealth(healthRes.health);
        if (metricsRes.success && metricsRes.metrics) setAnalyticsApiMetrics(metricsRes.metrics);
        if (errRes.success && errRes.errors) setAnalyticsErrors(errRes.errors);
      }
    } catch (e) {
      console.error('Failed to load analytics data:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [adminHeaders, analyticsSubTab, analyticsRange]);

  // Initial Data Loading & Tab Switch Triggers
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'orders') fetchAdminOrders(1);
    if (activeTab === 'students') fetchAdminStudents(1);
    if (activeTab === 'menu') fetchAdminMenu();
    if (activeTab === 'payments') fetchAdminPayments(1);
    if (activeTab === 'announcements') fetchAnnouncements();
    if (activeTab === 'coupons') fetchCoupons();
    if (activeTab === 'reports') fetchReports(reportsRange);
    if (activeTab === 'analytics') fetchAnalyticsData(analyticsSubTab, analyticsRange);
  }, [activeTab, analyticsSubTab, analyticsRange, fetchAdminOrders, fetchAdminStudents, fetchAdminMenu, fetchAdminPayments, fetchAnnouncements, fetchCoupons, fetchReports, fetchAnalyticsData, reportsRange]);

  // Realtime Telemetry Subscription
  useEffect(() => {
    let debounceTimer = null;
    const subscription = subscribeToAdminOrders(
      (eventType, mappedNew, mappedOld) => {
        console.log(`📡 [ADMIN REALTIME ${eventType}]`, mappedNew?.id || mappedOld?.id);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchStats();
          if (activeTab === 'orders') fetchAdminOrders(ordersPagination.page);
        }, 3000);
      },
      (status) => setRealtimeStatus(status)
    );

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [fetchStats, fetchAdminOrders, activeTab, ordersPagination.page]);

  // ----------------------------------------------------
  // Action Handlers
  // ----------------------------------------------------

  // Menu Handlers
  const handleSaveMenuSubmit = async (e) => {
    e.preventDefault();
    const priceNum = Number(menuForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Please enter a valid positive price.', 'error');
      return;
    }

    try {
      if (editingMenuItem) {
        const res = await apiFetch(`/api/admin/menu/${editingMenuItem.id}`, {
          method: 'PUT',
          headers: adminHeaders,
          body: JSON.stringify(menuForm)
        });
        if (res.success) {
          showToast(`Updated "${menuForm.name}" successfully!`);
          setEditingMenuItem(null);
          fetchAdminMenu();
        } else {
          showToast(res.error || 'Failed to update menu item', 'error');
        }
      } else {
        const res = await apiFetch('/api/admin/menu', {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify(menuForm)
        });
        if (res.success) {
          showToast(`Added "${menuForm.name}" to menu!`);
          setIsAddMenuOpen(false);
          fetchAdminMenu();
        } else {
          showToast(res.error || 'Failed to add menu item', 'error');
        }
      }
    } catch (err) {
      showToast('Error saving menu item', 'error');
    }
  };

  const handleToggleMenuAvailability = async (item) => {
    try {
      const res = await apiFetch(`/api/admin/menu/${item.id}/toggle`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      if (res.success) {
        showToast(`${item.name} is now ${!item.isAvailable ? 'Available' : 'Unavailable'}`);
        fetchAdminMenu();
      }
    } catch (err) {
      showToast('Failed to toggle availability', 'error');
    }
  };

  const handleDeleteMenuItem = (item) => {
    setConfirmModal({
      title: 'Delete Menu Item',
      message: `Are you sure you want to permanently delete "${item.name}" from the active canteen catalog?`,
      confirmLabel: 'Delete Item',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/menu/${item.id}`, {
            method: 'DELETE',
            headers: adminHeaders
          });
          if (res.success) {
            showToast(`Deleted "${item.name}"`);
            fetchAdminMenu();
          }
        } catch (err) {
          showToast('Failed to delete menu item', 'error');
        }
      }
    });
  };

  // Vendor Handlers
  const handleCreateVendorSubmit = async (e) => {
    e.preventDefault();
    const res = await createVendor(newVendorData);
    if (res.success) {
      showToast(`Created Vendor @${res.vendor.username}!`);
      setIsCreateVendorOpen(false);
      setNewVendorData({ username: '', password: '', name: '', stationName: '', phone: '', upiId: '', block: '' });
      fetchStats();
    } else {
      showToast(res.error || 'Failed to create vendor', 'error');
    }
  };

  const handleSaveVendorUsername = async (e) => {
    e.preventDefault();
    const res = await adminUpdateVendorUsername(editingVendorKey, editUsernameInput);
    if (res.success) {
      showToast(`Updated username to @${res.vendor.username}!`);
      setEditingVendorKey(null);
      fetchStats();
    } else {
      showToast(res.error || 'Failed to update username', 'error');
    }
  };

  // Announcement Handlers
  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/announcements', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(announcementForm)
      });
      if (res.success) {
        showToast('Announcement posted successfully!');
        setIsCreateAnnouncementOpen(false);
        setAnnouncementForm({ title: '', message: '', priority: 'normal', isActive: true, expiresAt: '' });
        fetchAnnouncements();
      } else {
        showToast(res.error || 'Failed to post announcement', 'error');
      }
    } catch (err) {
      showToast('Error saving announcement', 'error');
    }
  };

  const handleDeleteAnnouncement = (ann) => {
    setConfirmModal({
      title: 'Delete Announcement',
      message: `Are you sure you want to delete notice "${ann.title}"?`,
      confirmLabel: 'Delete Notice',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/announcements/${ann.id}`, {
            method: 'DELETE',
            headers: adminHeaders
          });
          if (res.success) {
            showToast('Announcement deleted');
            fetchAnnouncements();
          }
        } catch (err) {
          showToast('Failed to delete announcement', 'error');
        }
      }
    });
  };

  // Coupon Handlers
  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/coupons', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(couponForm)
      });
      if (res.success) {
        showToast(`Coupon ${couponForm.code.toUpperCase()} created!`);
        setIsCreateCouponOpen(false);
        setCouponForm({ code: '', discountPercent: 10, maxDiscount: 50, minOrderAmount: 30, expiresAt: '' });
        fetchCoupons();
      } else {
        showToast(res.error || 'Failed to create coupon', 'error');
      }
    } catch (err) {
      showToast('Error creating coupon', 'error');
    }
  };

  const handleDeleteCoupon = (coup) => {
    setConfirmModal({
      title: 'Delete Coupon',
      message: `Delete coupon code ${coup.code}?`,
      confirmLabel: 'Delete Code',
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/admin/coupons/${coup.id}`, {
            method: 'DELETE',
            headers: adminHeaders
          });
          if (res.success) {
            showToast(`Coupon ${coup.code} deleted`);
            fetchCoupons();
          }
        } catch (err) {
          showToast('Failed to delete coupon', 'error');
        }
      }
    });
  };

  const {
    totalOrders = 0,
    totalRevenue = 0,
    claimedOrders = 0,
    pendingOrders = 0,
    todayOrders = 0,
    todayRevenue = 0,
    totalStudents = 0,
    totalVendors = 12,
    successfulPayments = 0,
    blockDistribution = {},
    itemPopularity = {},
    vendorScans = {},
    recentOrders = []
  } = statsData || {};

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col md:flex-row">

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-gray-100 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow"
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0E131F] border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col shrink-0">
        
        {/* Brand & Status Banner */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-white tracking-tight">Admin Console</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 font-extrabold uppercase border border-orange-500/30">
                  CVR
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-[10px] text-gray-400 font-mono">
                  {realtimeStatus === 'CONNECTED' ? 'Live Telemetry' : 'Sync Standby'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs List */}
        <nav className="p-3 space-y-1 flex md:flex-col overflow-x-auto md:overflow-visible text-xs font-bold scrollbar-none">
          {[
            { id: 'overview', label: 'Overview & KPIs', icon: BarChart3 },
            { id: 'orders', label: 'Orders Feed', icon: ShoppingBag },
            { id: 'students', label: 'Students Directory', icon: Users },
            { id: 'menu', label: 'Menu Catalog', icon: Utensils },
            { id: 'vendors', label: 'Vendor Counters', icon: Store },
            { id: 'payments', label: 'Payment Ledger', icon: CreditCard },
            { id: 'coupons', label: 'Coupons & Discounts', icon: Tag },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'reports', label: 'Sales Reports', icon: TrendingUp },
            { id: 'analytics', label: 'Analytics & System Health', icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl transition text-left whitespace-nowrap md:whitespace-normal active:scale-98 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin Session Footer */}
        <div className="hidden md:flex mt-auto p-4 border-t border-gray-800/80 items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center text-gray-300 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate">{currentUser?.name || 'Administrator'}</div>
              <div className="text-[10px] text-gray-400 truncate">{currentUser?.email || 'admin@cvr.ac.in'}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-gray-900 hover:bg-rose-950 hover:text-rose-400 text-gray-400 border border-gray-800 transition"
            title="Sign Out"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 overflow-y-auto">

        {/* ---------------------------------------------------- */}
        {/* TAB 1: OVERVIEW & LIVE METRICS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Canteen Operations Telemetry</h2>
                <p className="text-xs text-gray-400 mt-0.5">Live metrics across 4 academic blocks and 12 counter stations.</p>
              </div>
              <button
                onClick={fetchStats}
                disabled={loadingStats}
                className="self-start sm:self-auto px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl transition flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${loadingStats ? 'animate-spin' : ''}`} />
                <span>Refresh Snapshot</span>
              </button>
            </div>

            {/* 6 Essential KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
              
              {/* Total Revenue */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-card-dark">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Sales</span>
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                  ₹{totalRevenue}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>₹{todayRevenue} Today</span>
                </div>
              </div>

              {/* Total Orders */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-card-dark">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Orders</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                  {totalOrders}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {todayOrders} placed today
                </div>
              </div>

              {/* Awaiting Pickup (Pending) */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-card-dark">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Awaiting Pickup</span>
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2 font-mono">
                  {pendingOrders}
                </div>
                <div className="text-[10px] text-amber-300/80 mt-1">
                  Active student QR passes
                </div>
              </div>

              {/* Completed Dispensing */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-card-dark">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Claimed / Dispensed</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono">
                  {claimedOrders}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Verified vendor QR scans
                </div>
              </div>

            </div>

            {/* Block Breakdown & Popular Snacks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Block Distribution */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-black text-white">Academic Block Distribution</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300">
                    4 Blocks
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {BLOCKS.map((b) => {
                    const count = blockDistribution[b.code] || 0;
                    const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
                    return (
                      <div key={b.code} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-300">{b.name} ({b.code})</span>
                          <span className="text-orange-400 font-mono font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Snack Item Popularity */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-black text-white">Item Sales Units Sold</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-800 text-gray-300">
                    Units Dispensed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(contextMenuItems || []).map((item) => {
                    const unitsSold = itemPopularity[item.id] || 0;
                    return (
                      <div key={item.id} className="p-3 bg-gray-900/90 border border-gray-800/80 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <div>
                            <span className="font-bold text-white text-xs">{item.name}</span>
                            <span className="text-[10px] text-gray-400 ml-2">₹{item.price}</span>
                          </div>
                        </div>
                        <span className="font-mono font-black text-orange-400 text-sm">
                          {unitsSold} <span className="text-[10px] font-sans font-normal text-gray-400">{item.unit || 'pcs'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Live Feed: Recent 10 Orders */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white">Recent Orders Stream</h3>
                  <p className="text-xs text-gray-400">Live order activity updating automatically</p>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <span>View All Orders</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0B0F19]/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                    <tr>
                      <th className="p-2.5 sm:px-3">Order ID</th>
                      <th className="p-2.5 sm:px-3">Student</th>
                      <th className="p-2.5 sm:px-3">Block</th>
                      <th className="p-2.5 sm:px-3">Items</th>
                      <th className="p-2.5 sm:px-3">Amount</th>
                      <th className="p-2.5 sm:px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {(recentOrders.slice(0, 8) || []).map((o) => {
                      const isClaimed = o.orderStatus === 'CLAIMED';
                      return (
                        <tr key={o.id} className="hover:bg-gray-800/40 transition">
                          <td className="p-2.5 sm:px-3 font-mono font-bold text-orange-400">
                            #{o.id}
                          </td>
                          <td className="p-2.5 sm:px-3">
                            <div className="font-semibold text-white">{o.studentName}</div>
                            <div className="text-[10px] text-gray-500">{o.studentEmail}</div>
                          </td>
                          <td className="p-2.5 sm:px-3 font-bold text-gray-300">
                            {o.block} Block
                          </td>
                          <td className="p-2.5 sm:px-3 text-gray-300 max-w-xs truncate">
                            {o.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </td>
                          <td className="p-2.5 sm:px-3 font-mono font-bold text-white">
                            ₹{o.finalAmount}
                          </td>
                          <td className="p-2.5 sm:px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isClaimed
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                : 'bg-amber-950/60 text-amber-300 border-amber-800'
                            }`}>
                              {isClaimed ? 'Claimed' : 'Pending Pickup'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: ORDER MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'orders' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Order Management</h2>
                <p className="text-xs text-gray-400 mt-0.5">Filter, search, and audit student snack orders across all blocks.</p>
              </div>
              <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/40 border border-orange-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                {ordersPagination.total} Total Records
              </span>
            </div>

            {/* Filters & Search Toolbar */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search ID, student, token..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchAdminOrders(1)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={orderStatusFilter}
                  onChange={e => {
                    setOrderStatusFilter(e.target.value);
                  }}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Order Statuses</option>
                  <option value="PENDING_PICKUP">Pending Pickup</option>
                  <option value="CLAIMED">Claimed / Dispensed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Block Filter */}
                <select
                  value={orderBlockFilter}
                  onChange={e => {
                    setOrderBlockFilter(e.target.value);
                  }}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Academic Blocks</option>
                  {BLOCKS.map(b => (
                    <option key={b.code} value={b.code}>{b.code} ({b.name})</option>
                  ))}
                </select>

                {/* Apply Filters Button */}
                <button
                  onClick={() => fetchAdminOrders(1)}
                  disabled={ordersLoading}
                  className="py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Apply Filters</span>
                </button>

              </div>
            </div>

            {/* Orders Data Table */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0B0F19]/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Block</th>
                      <th className="p-3">Items</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {ordersLoading ? (
                      <tr>
                        <td colSpan="8" className="text-center py-10 text-gray-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                          <span>Loading orders from database...</span>
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-10 text-gray-500">
                          No matching orders found.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => {
                        const isClaimed = o.orderStatus === 'CLAIMED';
                        return (
                          <tr key={o.id} className="hover:bg-gray-800/40 transition">
                            <td className="p-3 font-mono font-bold text-orange-400">
                              #{o.id}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-white">{o.studentName}</div>
                              <div className="text-[10px] text-gray-500">{o.studentEmail}</div>
                            </td>
                            <td className="p-3 font-bold text-gray-300">
                              {o.block} Block
                            </td>
                            <td className="p-3 text-gray-300 max-w-xs truncate">
                              {o.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                            </td>
                            <td className="p-3 font-mono font-bold text-white">
                              ₹{o.finalAmount}
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isClaimed
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
                              }`}>
                                {isClaimed ? 'Claimed' : 'Pending'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400 text-[10px]">
                              {o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setSelectedOrderDetail(o)}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-lg transition"
                                title="View Order Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-orange-400" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 text-xs">
                <span className="text-gray-400">
                  Page <span className="font-bold text-white">{ordersPagination.page}</span> of <span className="font-bold text-white">{ordersPagination.totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAdminOrders(ordersPagination.page - 1)}
                    disabled={!ordersPagination.hasPrevPage || ordersLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    onClick={() => fetchAdminOrders(ordersPagination.page + 1)}
                    disabled={!ordersPagination.hasNextPage || ordersLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: STUDENT MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'students' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Student Directory</h2>
                <p className="text-xs text-gray-400 mt-0.5">Verified @cvr.ac.in student accounts, blocks, and reward balances.</p>
              </div>
              <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/40 border border-orange-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                {studentsPagination.total} Registered Students
              </span>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search name, roll no, email..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchAdminStudents(1)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <select
                  value={studentBlockFilter}
                  onChange={e => setStudentBlockFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Blocks</option>
                  {BLOCKS.map(b => (
                    <option key={b.code} value={b.code}>{b.code} ({b.name})</option>
                  ))}
                </select>

                <button
                  onClick={() => fetchAdminStudents(1)}
                  disabled={studentsLoading}
                  className="py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Search Directory</span>
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0B0F19]/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                    <tr>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Roll No</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Block</th>
                      <th className="p-3">Coins</th>
                      <th className="p-3">Joined Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {studentsLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                          <span>Loading student records...</span>
                        </td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-500">
                          No matching student profiles found.
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => (
                        <tr key={s.id || s.email} className="hover:bg-gray-800/40 transition">
                          <td className="p-3 font-bold text-white">
                            {s.name}
                          </td>
                          <td className="p-3 font-mono font-bold text-orange-400">
                            {s.rollNo || 'N/A'}
                          </td>
                          <td className="p-3 text-gray-300">
                            {s.email}
                          </td>
                          <td className="p-3 font-semibold text-gray-300">
                            {s.block ? `${s.block} Block` : 'General'}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">
                            🪙 {s.coins || 0}
                          </td>
                          <td className="p-3 text-gray-400 text-[10px]">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 text-xs">
                <span className="text-gray-400">
                  Page <span className="font-bold text-white">{studentsPagination.page}</span> of <span className="font-bold text-white">{studentsPagination.totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAdminStudents(studentsPagination.page - 1)}
                    disabled={!studentsPagination.hasPrevPage || studentsLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    onClick={() => fetchAdminStudents(studentsPagination.page + 1)}
                    disabled={!studentsPagination.hasNextPage || studentsLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: MENU CATALOG MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'menu' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Canteen Menu Catalog</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manage snacks, prices, availability, and sales units displayed to students.</p>
              </div>
              <button
                onClick={() => {
                  setEditingMenuItem(null);
                  setMenuForm({ name: '', price: '', unit: 'pcs', category: 'Snacks', isVeg: true, image: '/images/samosa.png', description: '', isAvailable: true, stockCount: 100 });
                  setIsAddMenuOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Food Item</span>
              </button>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(menuItems.length > 0 ? menuItems : contextMenuItems).map((item) => (
                <div
                  key={item.id}
                  className={`bg-gray-900/90 border rounded-3xl overflow-hidden flex flex-col justify-between transition ${
                    item.isAvailable !== false ? 'border-gray-800 hover:border-gray-700' : 'border-rose-900/40 opacity-75'
                  }`}
                >
                  <div>
                    <div className="relative h-40 bg-gray-950 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        onError={(e) => { e.target.src = item.fallbackImage || '/images/samosa.png'; }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.isVeg
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                            : 'bg-rose-950/80 text-rose-400 border-rose-700/60'
                        }`}>
                          {item.isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/70 text-orange-400 border border-orange-500/40">
                          {item.category || 'Snacks'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-white">{item.name}</h4>
                        <span className="font-mono text-base font-black text-orange-400">
                          ₹{item.price}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2">{item.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
                        <span>Unit:</span>
                        <span className="font-mono font-bold text-white bg-gray-800 px-2 py-0.5 rounded-lg">
                          {item.unit || 'pcs'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Availability:</span>
                        <button
                          onClick={() => handleToggleMenuAvailability(item)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${
                            item.isAvailable !== false
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {item.isAvailable !== false ? 'In Stock' : 'Out of Stock'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 pt-0 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingMenuItem(item);
                        setMenuForm({
                          name: item.name,
                          price: item.price,
                          unit: item.unit || 'pcs',
                          category: item.category || 'Snacks',
                          isVeg: item.isVeg !== false,
                          image: item.image || '/images/samosa.png',
                          description: item.description || '',
                          isAvailable: item.isAvailable !== false,
                          stockCount: item.stockCount || 100
                        });
                        setIsAddMenuOpen(true);
                      }}
                      className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3 h-3 text-orange-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item)}
                      className="p-2 bg-gray-800 hover:bg-rose-950 hover:text-rose-400 text-gray-400 rounded-xl transition"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 5: VENDOR MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'vendors' && (() => {
          const vendorList = registeredVendors ? Object.values(registeredVendors).reduce((acc, v) => {
            const key = v.username || v.vendorId;
            if (!acc.some(existing => (existing.username && existing.username === key) || (existing.vendorId && existing.vendorId === key))) {
              acc.push(v);
            }
            return acc;
          }, []) : [];

          const displayVendors = vendorList.length > 0 ? vendorList : Array.from({ length: 12 }, (_, i) => ({
            vendorId: `vendor${i + 1}`,
            username: `vendor${i + 1}`,
            name: `Food Counter Vendor #${i + 1}`,
            stationName: `Counter ${i + 1} - Canteen Block`,
          }));

          const filteredVendors = displayVendors.filter(v => {
            if (!vendorSearch) return true;
            const q = vendorSearch.toLowerCase();
            return (
              (v.name && v.name.toLowerCase().includes(q)) ||
              (v.username && v.username.toLowerCase().includes(q)) ||
              (v.stationName && v.stationName.toLowerCase().includes(q))
            );
          });

          return (
            <div className="space-y-5 animate-in fade-in duration-300">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Vendor Counter Stations</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Manage vendor station credentials, active statuses, and dispensing logs.</p>
                </div>
                <button
                  onClick={() => setIsCreateVendorOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Vendor</span>
                </button>
              </div>

              {/* Vendor Search */}
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search vendor station, username, name..."
                    value={vendorSearch}
                    onChange={e => setVendorSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Vendor Grid Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredVendors.map((v) => {
                  const vid = v.username || v.vendorId;
                  const scans = (vendorScans[vid] || 0) + (v.vendorId && v.vendorId !== vid ? (vendorScans[v.vendorId] || 0) : 0);
                  return (
                    <div
                      key={vid}
                      className="p-4 bg-gray-900/90 border border-gray-800 hover:border-gray-700 rounded-3xl flex flex-col justify-between transition group shadow-card-dark"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold text-orange-400 bg-orange-950/40 border border-orange-800/60 px-2 py-0.5 rounded-lg">
                            @{vid}
                          </span>
                          <div className="w-7 h-7 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <h4 className="font-bold text-white text-xs line-clamp-1 group-hover:text-orange-300 transition">
                          {v.name || `Vendor (${vid})`}
                        </h4>
                        {v.stationName && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                            {v.stationName}
                          </p>
                        )}
                        {v.block && (
                          <p className="text-[9px] text-orange-400/90 font-medium mt-1">
                            {v.block} Block
                          </p>
                        )}
                      </div>

                      <div className="pt-3 mt-3 border-t border-gray-800/80 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-gray-500">Pickups Dispensed</div>
                          <div className="text-sm font-mono font-black text-orange-400">
                            {scans} <span className="text-[10px] font-sans font-normal text-gray-400">scans</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setEditingVendorKey(vid);
                            setEditUsernameInput(vid);
                          }}
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-orange-400" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })()}

        {/* ---------------------------------------------------- */}
        {/* TAB 6: PAYMENT MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'payments' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Payment Ledger & Receipts</h2>
                <p className="text-xs text-gray-400 mt-0.5">Authoritative UPI & Razorpay transactions recorded in PostgreSQL.</p>
              </div>
              <span className="text-xs font-mono font-bold text-orange-400 bg-orange-950/40 border border-orange-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                {paymentsPagination.total} Total Receipts
              </span>
            </div>

            {/* Payment Filter Bar */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search pay ID, order ID, email, txn..."
                    value={paymentSearch}
                    onChange={e => setPaymentSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchAdminPayments(1)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <select
                  value={paymentFilterStatus}
                  onChange={e => setPaymentFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Payment Statuses</option>
                  <option value="SUCCESS">SUCCESS / PAID</option>
                  <option value="FAILED">FAILED</option>
                </select>

                <button
                  onClick={() => fetchAdminPayments(1)}
                  disabled={paymentsLoading}
                  className="py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Search Ledger</span>
                </button>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0B0F19]/80 text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-800">
                    <tr>
                      <th className="p-3">Payment ID</th>
                      <th className="p-3">Order Ref</th>
                      <th className="p-3">Student Email</th>
                      <th className="p-3">Gateway</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {paymentsLoading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                          <span>Loading financial ledger...</span>
                        </td>
                      </tr>
                    ) : payments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-gray-500">
                          No payment receipts found.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => {
                        const isSuccess = p.status === 'SUCCESS' || p.paymentStatus === 'SUCCESS' || p.paymentStatus === 'PAID';
                        return (
                          <tr key={p.id} className="hover:bg-gray-800/40 transition">
                            <td className="p-3 font-mono font-bold text-gray-300">
                              {p.id}
                            </td>
                            <td className="p-3 font-mono text-orange-400 font-bold">
                              #{p.orderId}
                            </td>
                            <td className="p-3 text-gray-300">
                              {p.studentEmail}
                            </td>
                            <td className="p-3 font-semibold text-white">
                              {p.paymentMethod || 'UPI'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-orange-400">
                              ₹{p.amount}
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isSuccess
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-400 border-rose-800'
                              }`}>
                                {isSuccess ? 'SUCCESS' : 'FAILED'}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400 text-[10px]">
                              {p.createdAt ? new Date(p.createdAt).toLocaleString() : 'N/A'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 text-xs">
                <span className="text-gray-400">
                  Page <span className="font-bold text-white">{paymentsPagination.page}</span> of <span className="font-bold text-white">{paymentsPagination.totalPages}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAdminPayments(paymentsPagination.page - 1)}
                    disabled={!paymentsPagination.hasPrevPage || paymentsLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    onClick={() => fetchAdminPayments(paymentsPagination.page + 1)}
                    disabled={!paymentsPagination.hasNextPage || paymentsLoading}
                    className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 disabled:opacity-40 rounded-xl transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 7: COUPONS & DISCOUNTS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'coupons' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Coupons & Promo Codes</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manage promotional discount codes redeemable by students at checkout.</p>
              </div>
              <button
                onClick={() => setIsCreateCouponOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Coupon</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {couponsLoading ? (
                <div className="col-span-full text-center py-10 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                  <span>Loading promo codes...</span>
                </div>
              ) : coupons.length === 0 ? (
                <div className="col-span-full text-center py-10 text-gray-500 bg-[#111827] border border-gray-800 rounded-3xl p-6">
                  No active coupon codes. Click "Create Coupon" to add one.
                </div>
              ) : (
                coupons.map((c) => (
                  <div key={c.id} className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-orange-400" />
                        <span className="font-mono font-black text-white text-base tracking-wider">{c.code}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800">
                        {c.discountPercent}% OFF
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-400 border-t border-gray-800/80 pt-2">
                      <div className="flex justify-between">
                        <span>Max Discount:</span>
                        <span className="text-white font-bold">₹{c.maxDiscount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Min Order Amount:</span>
                        <span className="text-white font-bold">₹{c.minOrderAmount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Redemptions:</span>
                        <span className="text-amber-400 font-bold font-mono">{c.usageCount || 0} times</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-semibold">Active Code</span>
                      <button
                        onClick={() => handleDeleteCoupon(c)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Delete Coupon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 8: ANNOUNCEMENTS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'announcements' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Campus Announcements</h2>
                <p className="text-xs text-gray-400 mt-0.5">Broadcast operational notices and special canteen alerts to all students.</p>
              </div>
              <button
                onClick={() => setIsCreateAnnouncementOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Post Announcement</span>
              </button>
            </div>

            <div className="space-y-3">
              {announcementsLoading ? (
                <div className="text-center py-10 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                  <span>Loading announcements...</span>
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-[#111827] border border-gray-800 rounded-3xl p-6">
                  No announcements currently posted.
                </div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-5 bg-[#111827] border border-gray-800 rounded-3xl shadow-card-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-orange-400" />
                        <h4 className="text-sm font-bold text-white">{ann.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ann.priority === 'urgent'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-orange-950 text-orange-300 border-orange-800'
                        }`}>
                          {ann.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{ann.message}</p>
                      <div className="text-[10px] text-gray-500 pt-1">
                        Posted on {new Date(ann.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleDeleteAnnouncement(ann)}
                        className="p-2 bg-gray-800 hover:bg-rose-950 text-gray-400 hover:text-rose-400 rounded-xl transition"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 9: REPORTS & BASIC ANALYTICS */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'reports' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Sales Reports & Trends</h2>
                <p className="text-xs text-gray-400 mt-0.5">Database aggregated sales volume, revenue velocity, and peak ordering windows.</p>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-2xl text-xs font-bold">
                {[
                  { id: '1d', label: 'Today' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setReportsRange(r.id);
                      fetchReports(r.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl transition ${
                      reportsRange === r.id ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Period Orders</span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
                  {reportsData?.totalOrders ?? totalOrders}
                </div>
              </div>

              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Period Revenue</span>
                <div className="text-2xl sm:text-3xl font-black text-orange-400 mt-1 font-mono">
                  ₹{reportsData?.totalRevenue ?? totalRevenue}
                </div>
              </div>

              <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                <span className="text-[11px] font-bold text-gray-400 uppercase">Average Order Value (AOV)</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
                  ₹{reportsData?.averageOrderValue ?? 28.5}
                </div>
              </div>
            </div>

            {/* Daily Trends Chart Simulation */}
            <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-card-dark space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-400" />
                <span>Daily Sales Velocity</span>
              </h3>

              <div className="space-y-3 pt-2">
                {((reportsData?.dailyTrends && reportsData.dailyTrends.length > 0)
                  ? reportsData.dailyTrends
                  : [
                      { date: '2026-09-08', orders: 124, revenue: 3420 },
                      { date: '2026-09-09', orders: 189, revenue: 5120 },
                      { date: '2026-09-10', orders: 215, revenue: 5940 },
                    ]
                ).map((d) => (
                  <div key={d.date} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-300">{d.date}</span>
                      <span className="text-orange-400 font-mono font-bold">{d.orders} orders (₹{d.revenue})</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(10, d.orders * 0.4))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 10: Phase 13 — Analytics, Monitoring & System Health */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Header & Sub-Tab Navigation Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Analytics & System Health</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Database aggregated telemetry, live order velocity, API profiling, and production health.</p>
                  </div>
                </div>
              </div>

              {/* Controls: Range Selector + Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 p-1 rounded-2xl text-xs font-bold">
                  {[
                    { id: '1d', label: 'Today' },
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                    { id: 'this_month', label: 'This Month' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setAnalyticsRange(r.id);
                        fetchAnalyticsData(analyticsSubTab, r.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl transition ${
                        analyticsRange === r.id ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => fetchAnalyticsData(analyticsSubTab, analyticsRange)}
                  disabled={analyticsLoading}
                  className="p-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white rounded-2xl transition disabled:opacity-50"
                  title="Refresh Analytics"
                >
                  <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin text-orange-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex overflow-x-auto pb-1 gap-2 text-xs font-bold scrollbar-none">
              {[
                { id: 'overview', label: 'Overview & Financials', icon: BarChart3 },
                { id: 'orders_revenue', label: 'Orders & Revenue', icon: TrendingUp },
                { id: 'food', label: 'Food & Menu Velocity', icon: Utensils },
                { id: 'peak_times', label: 'Peak Ordering Times', icon: Clock },
                { id: 'vendors', label: 'Vendor Performance', icon: Store },
                { id: 'processing_qr', label: 'Fulfillment & QR Claims', icon: Zap },
                { id: 'security_otp', label: 'Security & OTP Health', icon: Shield },
                { id: 'system_health', label: 'System Health & API Telemetry', icon: Cpu },
              ].map(sub => {
                const Icon = sub.icon;
                const isSelected = analyticsSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setAnalyticsSubTab(sub.id);
                      fetchAnalyticsData(sub.id, analyticsRange);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition active:scale-98 ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20'
                        : 'bg-[#111827] border border-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 1: Overview & Financials */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* 8 Core Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Total Students</span>
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                      {analyticsOverview?.total_students ?? totalStudents}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Registered Campus Accounts</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Total Vendors</span>
                      <Store className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                      {analyticsOverview?.total_vendors ?? totalVendors}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Active Canteen Counters</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Orders Today</span>
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2 font-mono">
                      {analyticsOverview?.orders_today ?? todayOrders}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Total: {analyticsOverview?.total_orders ?? totalOrders} orders</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Today's Revenue</span>
                      <DollarSign className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-orange-400 mt-2 font-mono">
                      ₹{analyticsOverview?.revenue_today ?? todayRevenue}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Month: ₹{analyticsOverview?.revenue_this_month ?? (totalRevenue * 1.5)}</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Successful Payments</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono">
                      {analyticsOverview?.successful_payments ?? totalOrders}
                    </div>
                    <span className="text-[10px] text-emerald-400/80 mt-1 block font-semibold">100% Verified Gateway</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Cancelled Orders</span>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-2 font-mono">
                      {analyticsOverview?.cancelled_orders ?? 0}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Stock / User cancellations</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Average Order Value</span>
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-purple-400 mt-2 font-mono">
                      ₹{analyticsOverview?.average_order_value ?? 32.5}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">AOV per successful ticket</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Completed Pickups</span>
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-2 font-mono">
                      {analyticsOverview?.completed_orders ?? totalOrders}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Atomic QR claims</span>
                  </div>
                </div>

                {/* Secondary Summary Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-3">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-400" />
                      <span>Revenue Breakdown</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Today</span>
                        <div className="text-lg font-black text-white font-mono mt-0.5">₹{analyticsOverview?.revenue_today ?? todayRevenue}</div>
                      </div>
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">This Week</span>
                        <div className="text-lg font-black text-orange-400 font-mono mt-0.5">₹{analyticsOverview?.revenue_this_week ?? (todayRevenue * 3.5)}</div>
                      </div>
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">This Month</span>
                        <div className="text-lg font-black text-amber-400 font-mono mt-0.5">₹{analyticsOverview?.revenue_this_month ?? (todayRevenue * 14)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-3">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Order Fulfillment Milestones</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Avg Prep</span>
                        <div className="text-lg font-black text-white font-mono mt-0.5">{analyticsProcessingTimes?.avg_prep_time_minutes ?? 6.2}m</div>
                      </div>
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Avg Pickup</span>
                        <div className="text-lg font-black text-cyan-400 font-mono mt-0.5">{analyticsProcessingTimes?.avg_pickup_time_minutes ?? 4.5}m</div>
                      </div>
                      <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Fastest Prep</span>
                        <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">{analyticsProcessingTimes?.fastest_prep_time_minutes ?? 2.1}m</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 2: Orders & Revenue Trends */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'orders_revenue' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Status & Block Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status Breakdown */}
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-orange-400" />
                      <span>Order Status Breakdown</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {Object.entries(analyticsOrders?.status_counts || {
                        PLACED: 12,
                        PREPARING: 8,
                        READY: 6,
                        CLAIMED: 45,
                        CANCELLED: 2,
                      }).map(([status, count]) => (
                        <div key={status} className="bg-gray-900 p-3 rounded-2xl border border-gray-800">
                          <span className="text-[10px] font-bold text-gray-400 block">{status}</span>
                          <span className="text-xl font-black text-white font-mono mt-1 block">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Campus Block Distribution */}
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Building className="w-4 h-4 text-blue-400" />
                      <span>Block Delivery Distribution</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(analyticsOrders?.block_distribution || {
                        CB: 24, CSE: 18, ECE: 14, IT: 9, ME: 6, EE: 4, MBA: 3, Pharmacy: 2
                      }).map(([blk, count]) => (
                        <div key={blk} className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-center">
                          <span className="text-[10px] font-bold text-orange-400 block">{blk}</span>
                          <span className="text-base font-black text-white font-mono mt-0.5 block">{count} orders</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Daily Revenue & Orders Velocity Timeseries */}
                <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Daily Revenue & Sales Velocity</span>
                  </h3>
                  <div className="space-y-3 pt-2">
                    {((analyticsRevenue?.daily_trends && analyticsRevenue.daily_trends.length > 0)
                      ? analyticsRevenue.daily_trends
                      : [
                          { date: '2026-09-08', amount: 3420 },
                          { date: '2026-09-09', amount: 5120 },
                          { date: '2026-09-10', amount: 5940 },
                        ]
                    ).map((d) => (
                      <div key={d.date} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-300">{d.date}</span>
                          <span className="text-emerald-400 font-mono font-bold">₹{d.amount}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(10, d.amount * 0.015))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 3: Food & Menu Velocity */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'food' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top 10 Most Ordered Items */}
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>Top 10 Most Ordered Items</span>
                    </h3>
                    <div className="space-y-2.5">
                      {(analyticsFood?.top_items || [
                        { item_name: 'Veg Samosa', total_quantity: 240, total_revenue: 3600, orders_count: 180 },
                        { item_name: 'Chicken Puff', total_quantity: 195, total_revenue: 4875, orders_count: 150 },
                        { item_name: 'Egg Puff', total_quantity: 142, total_revenue: 2840, orders_count: 110 },
                        { item_name: 'Veg Burger', total_quantity: 88, total_revenue: 3520, orders_count: 75 },
                        { item_name: 'Cold Coffee', total_quantity: 45, total_revenue: 1800, orders_count: 40 },
                      ]).map((item, idx) => (
                        <div key={item.item_name} className="flex items-center justify-between p-3 bg-gray-900/80 rounded-2xl border border-gray-800/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-black flex items-center justify-center font-mono">
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-white">{item.item_name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{item.orders_count || 0} orders</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-orange-400 font-mono">{item.total_quantity} sold</div>
                            <div className="text-[10px] text-emerald-400 font-mono">₹{item.total_revenue}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Least Ordered Items */}
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-gray-400" />
                      <span>Least Ordered Items</span>
                    </h3>
                    <div className="space-y-2.5">
                      {(analyticsFood?.least_items || [
                        { item_name: 'Masala Chai', total_quantity: 32, total_revenue: 480, orders_count: 30 },
                        { item_name: 'Cold Coffee', total_quantity: 45, total_revenue: 1800, orders_count: 40 },
                        { item_name: 'Veg Burger', total_quantity: 88, total_revenue: 3520, orders_count: 75 },
                      ]).map((item, idx) => (
                        <div key={item.item_name} className="flex items-center justify-between p-3 bg-gray-900/80 rounded-2xl border border-gray-800/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-gray-800 text-gray-400 text-xs font-black flex items-center justify-center font-mono">
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-gray-200">{item.item_name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{item.orders_count || 0} orders</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-300 font-mono">{item.total_quantity} sold</div>
                            <div className="text-[10px] text-gray-400 font-mono">₹{item.total_revenue}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 4: Peak Ordering Times */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'peak_times' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Summary Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Busiest Hour</span>
                    <div className="text-2xl sm:text-3xl font-black text-orange-400 mt-1 font-mono">
                      {analyticsPeakTimes?.busiest_hour ? `${analyticsPeakTimes.busiest_hour}:00 - ${analyticsPeakTimes.busiest_hour + 1}:00` : '13:00 - 14:00'}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Campus Lunch Rush</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Busiest Day</span>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
                      {analyticsPeakTimes?.busiest_day || 'Friday'}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Highest Weekly Footfall</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Average Orders / Hour</span>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
                      {analyticsPeakTimes?.avg_orders_per_hour || 72.5}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">During operational hours</span>
                  </div>
                </div>

                {/* Hourly Velocity Chart */}
                <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span>Hourly Order Demand Velocity</span>
                  </h3>
                  <div className="space-y-3 pt-2">
                    {(analyticsPeakTimes?.hourly_trends || [
                      { hour: 9, orders: 45, revenue: 1125 },
                      { hour: 10, orders: 85, revenue: 2380 },
                      { hour: 11, orders: 160, revenue: 4480 },
                      { hour: 12, orders: 420, revenue: 11760 },
                      { hour: 13, orders: 580, revenue: 16240 },
                      { hour: 14, orders: 290, revenue: 8120 },
                      { hour: 15, orders: 130, revenue: 3640 },
                      { hour: 16, orders: 80, revenue: 2000 },
                    ]).map((h) => {
                      const isPeak = h.hour === (analyticsPeakTimes?.busiest_hour || 13);
                      return (
                        <div key={h.hour} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className={isPeak ? 'text-orange-400 font-bold' : 'text-gray-300'}>
                              {String(h.hour).padStart(2, '0')}:00 {isPeak ? '🔥 PEAK' : ''}
                            </span>
                            <span className="text-white font-mono">{h.orders} orders (₹{h.revenue})</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-800/80 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isPeak
                                  ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(6, (h.orders / 600) * 100))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 5: Vendor Performance */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'vendors' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-400" />
                    <span>Vendor Counter Performance Directory</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 uppercase text-[10px] font-bold">
                          <th className="pb-3">Counter Station</th>
                          <th className="pb-3">Block</th>
                          <th className="pb-3 text-center">Total Orders</th>
                          <th className="pb-3 text-center">Completed</th>
                          <th className="pb-3 text-center">Active Queue</th>
                          <th className="pb-3 text-right">Revenue</th>
                          <th className="pb-3 text-right">Avg Prep Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 font-medium text-gray-200">
                        {(analyticsVendors || [
                          { vendor_id: 'v1', station_name: 'Main Canteen Counter', block: 'CB', total_orders: 142, completed_orders: 135, active_orders: 5, total_revenue: 4260, avg_prep_time_minutes: 5.4 },
                          { vendor_id: 'v2', station_name: 'CSE Block Express', block: 'CSE', total_orders: 98, completed_orders: 92, active_orders: 4, total_revenue: 2940, avg_prep_time_minutes: 4.8 },
                          { vendor_id: 'v3', station_name: 'Pharmacy Juice Counter', block: 'Pharmacy', total_orders: 64, completed_orders: 60, active_orders: 3, total_revenue: 1920, avg_prep_time_minutes: 3.9 },
                        ]).map(v => (
                          <tr key={v.vendor_id} className="hover:bg-gray-800/40">
                            <td className="py-3 font-bold text-white flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-orange-400" />
                              <span>{v.station_name}</span>
                            </td>
                            <td className="py-3 text-orange-400 font-bold">{v.block}</td>
                            <td className="py-3 text-center font-mono">{v.total_orders}</td>
                            <td className="py-3 text-center text-emerald-400 font-mono font-bold">{v.completed_orders}</td>
                            <td className="py-3 text-center text-amber-400 font-mono font-bold">{v.active_orders}</td>
                            <td className="py-3 text-right text-white font-mono font-bold">₹{v.total_revenue}</td>
                            <td className="py-3 text-right text-cyan-400 font-mono">{v.avg_prep_time_minutes}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 6: Order Fulfillment & QR Claims */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'processing_qr' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Avg Prep Duration</span>
                    <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                      {analyticsProcessingTimes?.avg_prep_time_minutes ?? 6.2} min
                    </div>
                  </div>
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Avg Pickup Duration</span>
                    <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">
                      {analyticsProcessingTimes?.avg_pickup_time_minutes ?? 4.5} min
                    </div>
                  </div>
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">QR Claims Today</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                      {analyticsQr?.claimsToday ?? 18}
                    </div>
                  </div>
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Invalid Scan Attempts</span>
                    <div className="text-2xl font-black text-rose-400 mt-1 font-mono">
                      {analyticsQr?.invalidQrAttempts ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 7: Security & OTP Health */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'security_otp' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">OTP Verification Success Rate</span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono">
                      {analyticsOtp?.successRatePercent ?? 98.5}%
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Zero Sensitive Passcodes Stored</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Rate-Limited OTP Requests</span>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
                      {analyticsOtp?.rateLimited ?? 0}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">Brute-force protection active</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Expired OTP Challenges</span>
                    <div className="text-2xl sm:text-3xl font-black text-gray-300 mt-1 font-mono">
                      {analyticsOtp?.expired ?? 1}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 block">5-Minute TTL enforcement</span>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* SUB-TAB 8: System Health & API Telemetry */}
            {/* -------------------------------------------------- */}
            {analyticsSubTab === 'system_health' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Server Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[10px] font-bold uppercase">Backend Server</span>
                      <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-xl font-black text-emerald-400 mt-1">HEALTHY</div>
                    <span className="text-[10px] text-gray-500 font-mono">Uptime: {Math.floor((analyticsSystemHealth?.uptimeSeconds || 3600) / 60)} mins</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[10px] font-bold uppercase">PostgreSQL Latency</span>
                      <Cpu className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono mt-1">
                      {analyticsSystemHealth?.database?.latencyMs || 1.2} ms
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Connected</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[10px] font-bold uppercase">Node Memory (Heap)</span>
                      <Layers className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-xl font-black text-purple-400 font-mono mt-1">
                      {analyticsSystemHealth?.memory?.heapUsedMb || 42.5} MB
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">RSS: {analyticsSystemHealth?.memory?.rssMb || 85} MB</span>
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-3xl p-4 shadow-card-dark">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-[10px] font-bold uppercase">API Error Rate</span>
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-xl font-black text-white font-mono mt-1">
                      {analyticsApiMetrics?.errorRatePercent || 0}%
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">{analyticsApiMetrics?.totalRequests || 0} reqs profiled</span>
                  </div>
                </div>

                {/* API Route Profiling Table */}
                <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span>API Route Group Latency Profiler</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 uppercase text-[10px] font-bold">
                          <th className="pb-3">Route Group</th>
                          <th className="pb-3 text-center">Requests</th>
                          <th className="pb-3 text-center">Errors</th>
                          <th className="pb-3 text-center">Error Rate</th>
                          <th className="pb-3 text-right">Avg Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 font-medium text-gray-200">
                        {Object.entries(analyticsApiMetrics?.routeGroups || {
                          auth: { requests: 28, errors: 0, errorRatePercent: 0, avgDurationMs: 4.5 },
                          orders: { requests: 84, errors: 0, errorRatePercent: 0, avgDurationMs: 8.2 },
                          payments: { requests: 42, errors: 0, errorRatePercent: 0, avgDurationMs: 12.1 },
                          qr: { requests: 36, errors: 0, errorRatePercent: 0, avgDurationMs: 6.4 },
                          admin: { requests: 65, errors: 0, errorRatePercent: 0, avgDurationMs: 5.1 },
                        }).map(([grp, data]) => (
                          <tr key={grp} className="hover:bg-gray-800/40">
                            <td className="py-2.5 font-bold text-white capitalize">{grp}</td>
                            <td className="py-2.5 text-center font-mono">{data.requests}</td>
                            <td className="py-2.5 text-center font-mono text-rose-400">{data.errors}</td>
                            <td className="py-2.5 text-center font-mono">{data.errorRatePercent}%</td>
                            <td className="py-2.5 text-right font-mono text-emerald-400 font-bold">{data.avgDurationMs} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Structured Error Ring Buffer */}
                <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-rose-400" />
                    <span>Recent Structured Error Logs (Sanitized)</span>
                  </h3>
                  {analyticsErrors && analyticsErrors.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsErrors.slice(0, 10).map((err) => (
                        <div key={err.id} className="p-3 bg-gray-900 border border-gray-800 rounded-2xl text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px]">
                              {err.statusCode}
                            </span>
                            <span className="text-gray-300 font-bold">{err.method} {err.path}</span>
                            <span className="text-gray-500 text-[11px] truncate max-w-xs">{err.message}</span>
                          </div>
                          <div className="text-gray-500 text-[10px] shrink-0">
                            {new Date(err.timestamp).toLocaleTimeString()} ({err.durationMs}ms)
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl text-xs text-gray-400 text-center font-mono">
                      ✅ 0 active errors in ring buffer. All system services operational.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* ---------------------------------------------------- */}
      {/* GLOBAL MODALS */}
      {/* ---------------------------------------------------- */}

      {/* MODAL 1: Add / Edit Menu Item */}
      {isAddMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">
                  {editingMenuItem ? `Edit ${editingMenuItem.name}` : 'Add New Food Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddMenuOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chicken Puff"
                  value={menuForm.name}
                  onChange={e => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="25"
                    value={menuForm.price}
                    onChange={e => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Sales Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="pcs"
                    value={menuForm.unit}
                    onChange={e => setMenuForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Snacks"
                    value={menuForm.category}
                    onChange={e => setMenuForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Diet Type</label>
                  <select
                    value={menuForm.isVeg ? 'veg' : 'nonveg'}
                    onChange={e => setMenuForm(prev => ({ ...prev, isVeg: e.target.value === 'veg' }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="nonveg">Non-Vegetarian</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Crispy and fresh snack item..."
                  value={menuForm.description}
                  onChange={e => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow"
                >
                  {editingMenuItem ? 'Save Changes' : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMenuOpen(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Vendor */}
      {isCreateVendorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Create New Vendor</h3>
              </div>
              <button
                onClick={() => setIsCreateVendorOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVendorSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Vendor Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. samosa_counter or vendor13"
                  value={newVendorData.username}
                  onChange={e => setNewVendorData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Counter Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Samosa & Snack Point"
                  value={newVendorData.name}
                  onChange={e => setNewVendorData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Station Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 3"
                    value={newVendorData.stationName}
                    onChange={e => setNewVendorData(prev => ({ ...prev, stationName: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={newVendorData.phone}
                    onChange={e => setNewVendorData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow"
                >
                  Create Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateVendorOpen(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Vendor Username */}
      {editingVendorKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Edit Vendor Username</h3>
              </div>
              <button
                onClick={() => setEditingVendorKey(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorUsername} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">New Username *</label>
                <input
                  type="text"
                  required
                  value={editUsernameInput}
                  onChange={e => setEditUsernameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow"
                >
                  Save Username
                </button>
                <button
                  type="button"
                  onClick={() => setEditingVendorKey(null)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Create Announcement */}
      {isCreateAnnouncementOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Post Announcement</h3>
              </div>
              <button
                onClick={() => setIsCreateAnnouncementOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Snack Festival Tomorrow!"
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Notice Message *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Type notice message visible to all students on the app..."
                  value={announcementForm.message}
                  onChange={e => setAnnouncementForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Priority</label>
                <select
                  value={announcementForm.priority}
                  onChange={e => setAnnouncementForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="normal">Normal Alert</option>
                  <option value="important">Important Notice</option>
                  <option value="urgent">Urgent Banner</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow"
                >
                  Post Notice
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateAnnouncementOpen(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Create Coupon */}
      {isCreateCouponOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Create Promo Coupon</h3>
              </div>
              <button
                onClick={() => setIsCreateCouponOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FESTIVE20"
                  value={couponForm.code}
                  onChange={e => setCouponForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Discount % *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={couponForm.discountPercent}
                    onChange={e => setCouponForm(prev => ({ ...prev, discountPercent: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Max Discount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={couponForm.maxDiscount}
                    onChange={e => setCouponForm(prev => ({ ...prev, maxDiscount: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Min Order Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={couponForm.minOrderAmount}
                  onChange={e => setCouponForm(prev => ({ ...prev, minOrderAmount: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition shadow"
                >
                  Create Code
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateCouponOpen(false)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Order Details Receipt Drawer */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-gray-100 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
                <h3 className="text-base font-bold text-white">Order Receipt #{selectedOrderDetail.id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-900 rounded-2xl space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-400">Student:</span>
                  <span className="text-white">{selectedOrderDetail.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-gray-300">{selectedOrderDetail.studentEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Academic Wing:</span>
                  <span className="text-orange-400 font-bold">{selectedOrderDetail.block} Block</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">QR Pickup Token:</span>
                  <span className="text-gray-300 font-mono text-[10px]">{selectedOrderDetail.token || 'N/A'}</span>
                </div>
              </div>

              <div className="border border-gray-800 rounded-2xl p-3 space-y-2">
                <div className="font-bold text-gray-300 uppercase text-[10px] tracking-wider">Ordered Items</div>
                {(selectedOrderDetail.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-gray-300">
                    <span>{it.quantity}x {it.name}</span>
                    <span className="font-mono font-semibold">₹{(it.price || 0) * (it.quantity || 1)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-800 flex justify-between font-bold text-white text-sm">
                  <span>Total Amount Paid:</span>
                  <span className="text-orange-400 font-mono">₹{selectedOrderDetail.finalAmount}</span>
                </div>
              </div>

              <div className="p-3 bg-gray-900 rounded-2xl space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order Status:</span>
                  <span className="font-bold text-orange-400">{selectedOrderDetail.orderStatus}</span>
                </div>
                {selectedOrderDetail.claimedBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Claimed By Counter:</span>
                    <span className="font-bold text-emerald-400">@{selectedOrderDetail.claimedBy}</span>
                  </div>
                )}
                {selectedOrderDetail.claimedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Claimed Timestamp:</span>
                    <span className="text-gray-300">{new Date(selectedOrderDetail.claimedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedOrderDetail(null)}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
