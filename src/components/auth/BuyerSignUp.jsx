import React, { useState } from 'react';
import { User, Mail, Lock, Phone, Hash, AlertCircle, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { requestEmailOtp } from '../../utils/otpService';
import { OtpModal } from '../common/OtpModal';

export const BuyerSignUp = ({ onSwitchToLogin }) => {
  const { registerStudent } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    let cleanEmail = formData.email.trim().toLowerCase();
    const cleanRoll = formData.rollNo.trim().toUpperCase();

    if (!cleanEmail && cleanRoll) {
      cleanEmail = `${cleanRoll.toLowerCase()}@cvr.ac.in`;
    } else if (cleanEmail && !cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@cvr.ac.in`;
    }
    
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!cleanEmail.endsWith('@cvr.ac.in')) {
      setError('College email must end with @cvr.ac.in (e.g. 22B81A0501@cvr.ac.in).');
      return;
    }

    const fallbackRoll = cleanRoll || cleanEmail.split('@')[0].toUpperCase();
    setFormData(prev => ({ ...prev, email: cleanEmail, rollNo: fallbackRoll }));

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await requestEmailOtp(cleanEmail, 'registration');
      if (res.success) {
        setOtpResult(res);
        setShowOtpModal(true);
      } else {
        setError(res.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err) {
      setError('Could not connect to authentication server. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = async () => {
    setShowOtpModal(false);
    let cleanEmail = formData.email.trim().toLowerCase();
    const cleanRoll = formData.rollNo.trim().toUpperCase();
    if (!cleanEmail && cleanRoll) {
      cleanEmail = `${cleanRoll.toLowerCase()}@cvr.ac.in`;
    } else if (cleanEmail && !cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@cvr.ac.in`;
    }
    const fallbackRoll = cleanRoll || cleanEmail.split('@')[0].toUpperCase();

    try {
      setLoading(true);
      const result = await registerStudent({
        name: formData.name.trim(),
        rollNo: fallbackRoll,
        email: cleanEmail,
        phone: formData.phone.trim(),
        password: formData.password,
      });

      if (result?.error) {
        setError(result.error);
      }
    } catch (e) {
      setError('Registration error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-8 bg-[#0B0F19] text-gray-100">
      <div className="w-full max-w-md">
        {/* Header with Official Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center max-w-[220px] h-20 rounded-3xl p-1 shadow-glow mb-2 overflow-hidden">
            <img
              src="/images/deliz-main.png"
              alt="Deliz"
              className="w-full h-full object-contain drop-shadow-xl"
            />
          </div>
          <h1 className="text-2xl font-black text-white">
            Create an Account
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Smart Campus Food Ordering & Pickup
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-5 sm:p-7 shadow-card-dark relative overflow-hidden">
          {error && (
            <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleInitialSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Varma"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  ROLL NO
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder=""
                    value={formData.rollNo}
                    onChange={e => handleChange('rollNo', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs uppercase focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                CVR Email Address (@cvr.ac.in) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@cvr.ac.in"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs font-mono focus:border-orange-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-orange-400/90 mt-0.5 font-medium">
                Must end with @cvr.ac.in. OTP will be sent for verification.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="tel"
                  placeholder=""
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 chars"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    className="w-full pl-9 pr-9 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={e => handleChange('confirmPassword', e.target.value)}
                    className="w-full pl-9 pr-9 py-2 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 text-xs min-h-[46px] active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-4 pt-3 border-t border-gray-800 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Already have an account? Sign in</span>
            </button>
          </div>
        </div>

        {/* Email OTP Verification Modal for Registration */}
        <OtpModal
          isOpen={showOtpModal}
          onClose={() => setShowOtpModal(false)}
          email={formData.email.trim().toLowerCase()}
          purpose="registration"
          initialOtpResult={otpResult}
          onVerified={handleOtpVerified}
        />

      </div>
    </div>
  );
};
