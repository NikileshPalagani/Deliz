import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Hash,
  Building2,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BLOCKS } from '../../types';
import { requestEmailOtp } from '../../utils/otpService';
import { OtpModal } from '../common/OtpModal';

export const UserProfile = () => {
  const { currentUser, updateProfile } = useApp();

  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    rollNo: currentUser?.rollNo || '',
    block: currentUser?.block || 'CB',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setError('');
    setSuccessMsg('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (formData.newPassword !== formData.confirmNewPassword) {
        setError('New passwords do not match.');
        return;
      }

      // If updating password, require email OTP verification
      try {
        setLoading(true);
        const res = await requestEmailOtp(currentUser.email, 'password_reset');
        if (res.success) {
          setOtpResult(res);
          setShowOtpModal(true);
        } else {
          setError(res.message || 'Unable to send OTP. Please try again.');
        }
      } catch (err) {
        setError('Network error sending OTP. Please check your connection.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Direct save if no password change
    setLoading(true);
    try {
      const res = await updateProfile({
        name: formData.name,
        phone: formData.phone,
        rollNo: formData.rollNo,
        block: formData.block,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg('Your profile details have been updated successfully!');
      }
    } catch (err) {
      setError('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = async () => {
    setShowOtpModal(false);
    setLoading(true);
    try {
      const res = await updateProfile({
        name: formData.name,
        phone: formData.phone,
        rollNo: formData.rollNo,
        block: formData.block,
        password: formData.newPassword,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setFormData(prev => ({ ...prev, newPassword: '', confirmNewPassword: '' }));
        setSuccessMsg('Your profile and password have been verified and updated successfully!');
      }
    } catch (err) {
      setError('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const coinCashValue = Math.floor((currentUser?.coins || 0) / 10);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-orange-400" />
          <span>Student Account</span>
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Manage your verified CVR details & pickup locations.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 shadow-card-dark relative overflow-hidden">
        
        {/* Coin Balance Badge */}
        <div className="p-4 bg-gradient-to-r from-amber-950/40 via-orange-950/40 to-amber-950/40 border border-amber-500/40 rounded-2xl flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-xl">
              🪙
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Reward Coins
              </div>
              <div className="text-xl font-black text-orange-400">
                {currentUser?.coins ?? 0} Coins
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            Worth <strong className="text-white">₹{coinCashValue} OFF</strong>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-orange-950/50 border border-orange-800/60 rounded-xl text-xs text-orange-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              CVR Account Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                disabled
                value={currentUser?.email || ''}
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 text-xs cursor-not-allowed"
              />
              <span className="absolute right-2.5 top-2 text-[9px] bg-orange-950 text-orange-400 font-bold px-2 py-0.5 rounded border border-orange-800/60">
                Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                Roll Number / ID
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={formData.rollNo}
                  onChange={e => handleChange('rollNo', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs uppercase focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
              Contact Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Block preferences */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
              Default Block
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
              <select
                value={formData.block}
                onChange={e => handleChange('block', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
              >
                {BLOCKS.map(b => (
                  <option key={b.code} value={b.code}>{b.code} ({b.name})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Password Update */}
          <div className="pt-3 border-t border-gray-800 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300 uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 text-orange-400" />
              <span>Change Password</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={formData.newPassword}
                  onChange={e => handleChange('newPassword', e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(p => !p)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={formData.confirmNewPassword}
                  onChange={e => handleChange('confirmNewPassword', e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(p => !p)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                  title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2 text-xs min-h-[46px] active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Profile & Password</span>
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-1.5">
              Changing password requires 6-digit email OTP verification.
            </p>
          </div>

        </form>
      </div>

      {/* Email OTP Verification Dialog for Password Change */}
      <OtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        email={currentUser?.email || ''}
        purpose="password_reset"
        initialOtpResult={otpResult}
        onVerified={handleOtpVerified}
      />
    </div>
  );
};
