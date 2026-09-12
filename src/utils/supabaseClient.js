import { createClient } from '@supabase/supabase-js';
import { apiFetch } from './api.js';

// Retrieve credentials strictly from Vite or process environment
const getEnvVar = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return '';
};

const supabaseUrl = (
  getEnvVar('VITE_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL') ||
  ''
).trim();

const supabaseAnonKey = (
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  ''
).trim();

export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
  );
};

export const supabase = (() => {
  try {
    if (isSupabaseConfigured()) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      });
    }
  } catch (e) {
    console.warn('⚠️ [SUPABASE INITIALIZATION ERROR]:', e);
  }
  return null;
})();

if (isSupabaseConfigured() && supabase) {
  console.log('⚡ [SUPABASE CLIENT INITIALIZED] Connected:', supabaseUrl);
}

/**
 * 1. Send OTP Function (`sendOtp`)
 * Uses backend Brevo HTTPS API for verified delivery
 */
export const sendOtp = async (email, purpose = 'registration') => {
  try {
    if (!email || !email.trim()) {
      return { success: false, error: 'Email address is required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const data = await apiFetch('/api/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, purpose }),
    });

    if (data.success) {
      return { success: true, message: data.message || 'OTP sent to your email' };
    } else {
      return { success: false, error: data.message || 'Unable to send OTP. Please try again.' };
    }
  } catch (err) {
    console.error('Unexpected sendOtp exception:', err);
    return { success: false, error: 'Could not connect to authentication server. Please check your network.' };
  }
};

/**
 * 2. Verify OTP Function (`verifyOtp`)
 */
export const verifyOtp = async (email, token, purpose = 'registration') => {
  try {
    if (!email || !token) {
      return { success: false, verified: false, error: 'Email and 6-digit OTP code are required.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = token.trim();

    const data = await apiFetch('/api/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, purpose }),
    });

    if (data.success && data.verified) {
      return {
        success: true,
        verified: true,
        resetToken: data.resetToken,
        message: data.message || 'Email verified successfully!',
      };
    } else {
      return {
        success: false,
        verified: false,
        error: data.message || 'Invalid or expired OTP code.',
      };
    }
  } catch (err) {
    console.error('Unexpected verifyOtp exception:', err);
    return { success: false, verified: false, error: 'An unexpected error occurred while verifying OTP.' };
  }
};

/**
 * 3. Centralized Student Registration
 */
export const registerStudentApi = async ({ email, password, name, phone, rollNo, block }) => {
  try {
    const data = await apiFetch('/api/auth/register-student', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, phone, rollNo, block }),
    });

    if (data.success && data.user) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || data.message || 'Registration failed.' };
  } catch (err) {
    return { success: false, error: 'Server error during registration.' };
  }
};

/**
 * 4. Centralized User Login
 */
export const loginUserApi = async (identifier, password) => {
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });

    if (data.success && data.user) {
      return { success: true, user: data.user, session: data.session };
    }
    return { success: false, error: data.error || data.message || 'Invalid credentials.' };
  } catch (err) {
    return { success: false, error: 'Server error during login.' };
  }
};

/**
 * 5. Fetch User Profile
 */
export const fetchUserProfileApi = async (userId, email) => {
  try {
    const data = await apiFetch('/api/auth/me', {
      method: 'POST',
      body: JSON.stringify({ userId, email }),
    });
    if (data.success && data.user) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error };
  } catch (e) {
    return { success: false, error: 'Failed to fetch user profile.' };
  }
};

/**
 * 6. Update Profile
 */
export const updateProfileApi = async (payload) => {
  try {
    const data = await apiFetch('/api/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.success && data.user) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || 'Failed to update profile.' };
  } catch (e) {
    return { success: false, error: 'Server error updating profile.' };
  }
};

/**
 * 7. Reset Password
 */
export const resetPasswordWithToken = async (email, resetToken, newPassword) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const data = await apiFetch('/api/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, resetToken, newPassword }),
    });

    if (data.success) {
      return { success: true, message: data.message || 'Password updated successfully!' };
    } else {
      return { success: false, error: data.message || 'Failed to reset password.' };
    }
  } catch (err) {
    console.error('Unexpected resetPasswordWithToken exception:', err);
    return { success: false, error: 'Server error resetting password.' };
  }
};

/**
 * 8. Session & Auth State Listeners
 */
export const subscribeToAuthChanges = (callback) => {
  if (!isSupabaseConfigured() || !supabase) return { unsubscribe: () => {} };
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
};

export const getCurrentSession = async () => {
  if (!isSupabaseConfigured() || !supabase) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (e) {
    return null;
  }
};

export const signOutUser = async () => {
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  }
  return true;
};

/**
 * 9. Realtime Order Mapping Helper
 * Converts Postgres snake_case order row to camelCase frontend model
 */
export const mapDbOrderToFrontend = (row) => {
  if (!row) return null;
  let parsedItems = [];
  try {
    if (Array.isArray(row.items)) {
      parsedItems = row.items;
    } else if (typeof row.items === 'string') {
      const parsed = JSON.parse(row.items);
      parsedItems = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    parsedItems = [];
  }
  return {
    id: row.id,
    token: row.token,
    studentEmail: row.student_email || row.studentEmail || '',
    studentName: row.student_name || row.studentName || 'Student',
    studentPhone: row.student_phone || row.studentPhone || '',
    block: row.block || 'CB',
    floor: row.floor || null,
    items: parsedItems,
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    discount: Number(row.discount ?? 0),
    finalAmount: Number(row.final_amount ?? row.finalAmount ?? 0),
    coinsEarned: Number(row.coins_earned ?? row.coinsEarned ?? 0),
    coinsRedeemed: Number(row.coins_redeemed ?? row.coinsRedeemed ?? 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'UPI',
    transactionId: row.transaction_id || row.transactionId || null,
    razorpayOrderId: row.razorpay_order_id || row.razorpayOrderId || null,
    paymentStatus: row.payment_status || row.paymentStatus || 'PAID',
    orderStatus: row.order_status || row.orderStatus || 'PENDING_PICKUP',
    claimedBy: row.claimed_by || row.claimedBy || null,
    claimedAt: row.claimed_at || row.claimedAt || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
};

/**
 * 10. Student Realtime Order Subscription
 * Listens strictly to orders for the authenticated student
 */
export const subscribeToStudentOrders = (studentEmail, onEvent, onStatusChange) => {
  if (!studentEmail || !isSupabaseConfigured() || !supabase) {
    return { unsubscribe: () => {} };
  }

  const cleanEmail = studentEmail.trim().toLowerCase();
  const channelName = `realtime_student_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

  console.log(`📡 [SUBSCRIPTION CREATED] Initializing realtime channel for student: ${cleanEmail}`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `student_email=eq.${cleanEmail}`,
      },
      (payload) => {
        try {
          const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
          const mappedNew = payload.new ? mapDbOrderToFrontend(payload.new) : null;
          const mappedOld = payload.old ? mapDbOrderToFrontend(payload.old) : null;
          if (onEvent) onEvent(eventType, mappedNew, mappedOld);
        } catch (err) {
          console.error('[REALTIME ERROR] Error processing student order event:', err);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`⚡ [REALTIME CONNECTED] Subscribed to student orders (${cleanEmail})`);
        if (onStatusChange) onStatusChange('CONNECTED');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`🔌 [REALTIME DISCONNECTED] Student channel ${channelName} status: ${status}`, err || '');
        if (onStatusChange) onStatusChange('DISCONNECTED');
      }
    });

  return {
    channel,
    unsubscribe: () => {
      try {
        console.log(`🧹 [SUBSCRIPTION REMOVED] Cleaning up student channel: ${channelName}`);
        supabase.removeChannel(channel);
      } catch (e) {
        console.error('Error removing student realtime channel:', e);
      }
    },
  };
};

/**
 * 11. Vendor Realtime Order Subscription
 * Listens to orders for vendor counters
 */
export const subscribeToVendorOrders = (vendorId, filterBlock, onEvent, onStatusChange) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { unsubscribe: () => {} };
  }

  const cleanVendorId = (vendorId || 'all_vendors').replace(/[^a-zA-Z0-9]/g, '_');
  const channelName = `realtime_vendor_${cleanVendorId}_${Date.now()}`;

  console.log(`📡 [SUBSCRIPTION CREATED] Initializing vendor realtime channel: ${channelName}`);

  const filterOptions = {
    event: '*',
    schema: 'public',
    table: 'orders',
  };

  if (filterBlock && filterBlock !== 'ALL') {
    filterOptions.filter = `block=eq.${filterBlock}`;
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      filterOptions,
      (payload) => {
        try {
          const eventType = payload.eventType;
          const mappedNew = payload.new ? mapDbOrderToFrontend(payload.new) : null;
          const mappedOld = payload.old ? mapDbOrderToFrontend(payload.old) : null;
          if (onEvent) onEvent(eventType, mappedNew, mappedOld);
        } catch (err) {
          console.error('[REALTIME ERROR] Error processing vendor order event:', err);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`⚡ [REALTIME CONNECTED] Subscribed to vendor orders stream`);
        if (onStatusChange) onStatusChange('CONNECTED');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`🔌 [REALTIME DISCONNECTED] Vendor channel ${channelName} status: ${status}`, err || '');
        if (onStatusChange) onStatusChange('DISCONNECTED');
      }
    });

  return {
    channel,
    unsubscribe: () => {
      try {
        console.log(`🧹 [SUBSCRIPTION REMOVED] Cleaning up vendor channel: ${channelName}`);
        supabase.removeChannel(channel);
      } catch (e) {
        console.error('Error removing vendor realtime channel:', e);
      }
    },
  };
};

/**
 * 12. Admin Realtime Order Subscription
 * Listens to order updates to trigger lightweight analytics updates
 */
export const subscribeToAdminOrders = (onEvent, onStatusChange) => {
  if (!isSupabaseConfigured() || !supabase) {
    return { unsubscribe: () => {} };
  }

  const channelName = `realtime_admin_${Date.now()}`;
  console.log(`📡 [SUBSCRIPTION CREATED] Initializing admin realtime channel: ${channelName}`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        try {
          const eventType = payload.eventType;
          const mappedNew = payload.new ? mapDbOrderToFrontend(payload.new) : null;
          const mappedOld = payload.old ? mapDbOrderToFrontend(payload.old) : null;
          if (onEvent) onEvent(eventType, mappedNew, mappedOld);
        } catch (err) {
          console.error('[REALTIME ERROR] Error processing admin order event:', err);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`⚡ [REALTIME CONNECTED] Subscribed to admin live order stream`);
        if (onStatusChange) onStatusChange('CONNECTED');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`🔌 [REALTIME DISCONNECTED] Admin channel status: ${status}`, err || '');
        if (onStatusChange) onStatusChange('DISCONNECTED');
      }
    });

  return {
    channel,
    unsubscribe: () => {
      try {
        console.log(`🧹 [SUBSCRIPTION REMOVED] Cleaning up admin channel: ${channelName}`);
        supabase.removeChannel(channel);
      } catch (e) {
        console.error('Error removing admin realtime channel:', e);
      }
    },
  };
};

/**
 * 13. Direct Supabase Order Fetch for Students (Permanent Resilient History)
 */
export const fetchStudentOrdersFromSupabase = async (studentEmail, limit = 100) => {
  if (!studentEmail || !isSupabaseConfigured() || !supabase) {
    return [];
  }
  try {
    const cleanEmail = studentEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .ilike('student_email', cleanEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[SUPABASE DIRECT FETCH] Order query note:', error.message);
      return [];
    }
    return (data || []).map(mapDbOrderToFrontend);
  } catch (err) {
    console.warn('[SUPABASE DIRECT FETCH] Unexpected exception:', err);
    return [];
  }
};

/**
 * 14. Direct Supabase Payment Fetch for Students
 */
export const fetchStudentPaymentsFromSupabase = async (studentEmail, limit = 100) => {
  if (!studentEmail || !isSupabaseConfigured() || !supabase) {
    return [];
  }
  try {
    const cleanEmail = studentEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .ilike('student_email', cleanEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[SUPABASE DIRECT FETCH] Payment query note:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[SUPABASE DIRECT FETCH] Unexpected exception:', err);
    return [];
  }
};


