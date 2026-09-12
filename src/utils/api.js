/**
 * Resolves the backend API base URL
 * - In local development: relative '/api' is proxied by Vite to http://127.0.0.1:5001
 * - In fullstack production (Render Web Service): relative '/api' hits the express server on the same host
 * - In decoupled deployment (Separate frontend host & backend host): VITE_API_URL or VITE_BACKEND_URL is used
 */
export const getBaseUrl = () => {
  let envUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '';
    }
  } catch (e) {}
  if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_API_URL || process.env.VITE_BACKEND_URL || '';
  }
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
};

export const getApiUrl = (endpoint = '') => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const base = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (base) {
    if (base.endsWith('/api') && cleanEndpoint.startsWith('/api')) {
      return `${base}${cleanEndpoint.slice(4)}`;
    }
    return `${base}${cleanEndpoint}`;
  }

  return cleanEndpoint;
};

/**
 * Universal safe API fetch helper with AbortController timeout
 * @param {string} endpoint - API route endpoint (e.g. '/api/send-otp')
 * @param {RequestInit & { timeoutMs?: number }} options - Fetch options including custom timeoutMs
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  const timeoutMs = options.timeoutMs || 30000; // 30 seconds for mobile data, cold starts, and traffic spikes

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Extract auth credentials from localStorage if available
  let authHeaders = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 1. Check Supabase auth token stored by supabase-js
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const token = parsed?.access_token || parsed?.currentSession?.access_token;
            if (token) {
              authHeaders['Authorization'] = `Bearer ${token}`;
              break;
            }
          }
        }
      }

      // 2. Check campus_bite_user for email and role headers
      const userRaw = window.localStorage.getItem('campus_bite_user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user?.email) {
          authHeaders['x-user-email'] = user.email;
        }
        if (user?.role) {
          authHeaders['x-user-role'] = user.role;
          if (user.role === 'admin') authHeaders['x-admin-role'] = 'admin';
          if (user.role === 'vendor') authHeaders['x-vendor-role'] = 'vendor';
        }
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.warn('[API] Failed to parse JSON response:', jsonErr);
      }
    } else {
      const text = await res.text();
      // Handle HTML error pages (Render 502/503/504/404)
      if (!res.ok) {
        let errMsg = `Server returned HTTP ${res.status}`;
        if (res.status === 404) {
          errMsg = 'Backend API route not found (404).';
        } else if (res.status === 502 || res.status === 503) {
          errMsg = 'Backend server is starting up on Render. Please try again in a few moments.';
        } else if (res.status === 504) {
          errMsg = 'Server request timed out. Please try again.';
        }
        return {
          success: false,
          status: res.status,
          message: errMsg,
        };
      }
      return { success: true, text };
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.message || data?.error || `Request failed with status ${res.status}`,
      };
    }

    return data || { success: true };

  } catch (networkErr) {
    clearTimeout(timeoutId);
    console.error(`[API] Error requesting ${url}:`, networkErr);

    if (networkErr.name === 'AbortError' || controller.signal.aborted) {
      return {
        success: false,
        isTimeout: true,
        message: 'The server is taking too long to respond (timeout). Render may be waking up—please try again.',
      };
    }

    return {
      success: false,
      isNetworkError: true,
      message: 'Could not connect to authentication server. Please check your network or ensure the backend server is running.',
    };
  }
};
