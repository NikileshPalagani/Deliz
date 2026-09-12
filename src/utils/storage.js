const STORAGE_KEYS = {
  USER: 'campus_bite_user',
  CART: 'campus_bite_cart',
  COINS: 'campus_bite_coins',
  ACTIVE_ORDERS: 'campus_bite_active_orders',
};

export const getStoredUser = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.email && typeof parsed.email !== 'string') return null;
      if (parsed.role && typeof parsed.role !== 'string') return null;
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[STORAGE] Failed to parse stored user, resetting to null:', err);
    return null;
  }
};

export const setStoredUser = (user) => {
  try {
    if (user && typeof user === 'object') {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  } catch (e) {
    console.error('Storage write error:', e);
  }
};

// Default coins for newly created accounts is strictly 0
export const getStoredCoins = (email) => {
  if (!email || typeof email !== 'string') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COINS);
    if (!raw) return 0;
    const allCoins = JSON.parse(raw);
    if (allCoins && typeof allCoins === 'object' && !Array.isArray(allCoins)) {
      const cleanEmail = email.toLowerCase().trim();
      const val = allCoins[cleanEmail] ?? allCoins[email];
      return typeof val === 'number' && !isNaN(val) ? Math.max(0, val) : 0;
    }
    return 0;
  } catch {
    return 0;
  }
};

export const setStoredCoins = (email, amount) => {
  if (!email || typeof email !== 'string') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COINS);
    let allCoins = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          allCoins = parsed;
        }
      } catch {}
    }
    const cleanEmail = email.toLowerCase().trim();
    allCoins[cleanEmail] = Math.max(0, Number(amount) || 0);
    localStorage.setItem(STORAGE_KEYS.COINS, JSON.stringify(allCoins));
  } catch (e) {
    console.error('Coins storage write error:', e);
  }
};

export const getStoredOrders = (email) => {
  if (!email || typeof email !== 'string') return [];
  try {
    const raw = localStorage.getItem(`campus_bite_orders_${email.toLowerCase().trim()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const setStoredOrders = (email, orders) => {
  if (!email || typeof email !== 'string') return;
  try {
    if (Array.isArray(orders)) {
      localStorage.setItem(`campus_bite_orders_${email.toLowerCase().trim()}`, JSON.stringify(orders.filter(Boolean)));
    }
  } catch (e) {
    console.error('Orders storage write error:', e);
  }
};

