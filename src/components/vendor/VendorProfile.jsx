import React, { useState } from 'react';
import {
  Store,
  User,
  Phone,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const VendorProfile = () => {
  const { currentUser, updateVendorProfile, setCurrentTab, logout, triggerCelebration } = useApp();

  const [formData, setFormData] = useState({
    username: currentUser?.username || currentUser?.vendorId || '',
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    stationName: currentUser?.stationName || '',
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccessMsg('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // 1. Validate Username (the only editable credential)
    const cleanUsername = formData.username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Please enter a valid vendor username.');
      return;
    }
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    setLoading(true);

    const result = await updateVendorProfile({
      username: cleanUsername,
      name: formData.name.trim() || `Food Counter Vendor (${cleanUsername})`,
      phone: formData.phone.trim(),
      stationName: formData.stationName.trim(),
    });

    setLoading(false);

    if (result.success) {
      setSuccessMsg('Vendor credentials updated successfully!');
      triggerCelebration();
    } else {
      setError(result.error || 'Failed to update vendor credentials.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6 animate-in fade-in">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrentTab('scanner')}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-orange-400" />
          <span>Back to Scanner</span>
        </button>

        <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-orange-950/80 border border-orange-500/50 text-orange-400 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Verified Station Terminal
        </span>
      </div>

      {/* Header Banner Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark mb-5 relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 flex items-center justify-center text-white shadow-glow">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-1.5">
              <span>{currentUser?.name || 'Food Counter Vendor'}</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Station Username: <span className="font-mono text-orange-400 font-bold">@{currentUser?.username || currentUser?.vendorId}</span>
            </p>
            {currentUser?.stationName && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {currentUser.stationName}
              </p>
            )}
            {currentUser?.block && (
              <div className="flex items-center gap-2 mt-1 text-[10px] text-orange-400 font-semibold">
                <span className="flex items-center gap-0.5">
                  <Building className="w-3 h-3 text-orange-400" />
                  <span>{currentUser.block} Block</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark relative">
        
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
          <User className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Edit Vendor Credentials
          </h2>
        </div>

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-600/70 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 shadow-glow">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-800/70 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Vendor Username - THE ONLY EDITABLE CREDENTIAL */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Vendor Login Username *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="e.g., vendor1 or samosa_counter"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-900/90 border border-gray-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-orange-500 transition"
                required
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              You will use this username to sign in at the vendor login portal.
            </p>
          </div>

          {/* Counter Display Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Counter Display Name
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-gray-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Food Counter Vendor #1"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-900/90 border border-gray-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Counter Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 9876543210"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-900/90 border border-gray-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Station / Counter Location */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Station / Counter Location
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-gray-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={formData.stationName}
                onChange={(e) => handleChange('stationName', e.target.value)}
                placeholder="e.g., Counter 1 - Canteen Block"
                className="w-full pl-10 pr-3 py-2.5 bg-gray-900/90 border border-gray-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-orange-500/25 transition flex items-center justify-center gap-2 active:scale-98 min-h-[48px]"
            >
              {loading ? (
                <span>Saving Credentials...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Vendor Credentials</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 text-center text-xs font-bold text-gray-400 hover:text-rose-400 rounded-xl hover:bg-gray-900/60 transition"
            >
              Sign Out from Counter Terminal
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
