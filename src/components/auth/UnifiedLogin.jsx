import React, { useState } from 'react';
import {
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  LockKeyhole,
  Eye,
  EyeOff,
  User
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { requestEmailOtp, verifyEmailOtp } from '../../utils/otpService';

export const UnifiedLogin = ({ onSwitchToSignUp }) => {
  const { loginUser, changePassword } = useApp();

  // Mode: 'password' | 'forgot_password'
  const [authMode, setAuthMode] = useState('password');

  // Forgot Password Steps: 'enter_email' | 'verify_otp' | 'new_password'
  const [forgotStep, setForgotStep] = useState('enter_email');

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [resetDigits, setResetDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(45);
  const [resending, setResending] = useState(false);

  const otpInputRefs = React.useRef([]);

  // Cooldown countdown
  React.useEffect(() => {
    let timer;
    if (resendCooldown > 0 && authMode === 'forgot_password' && forgotStep === 'verify_otp') {
      timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown, authMode, forgotStep]);

  const switchMode = (mode) => {
    setAuthMode(mode);
    setForgotStep('enter_email');
    setError('');
    setSuccessMessage('');
    setResetDigits(['', '', '', '', '', '']);
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  // ----------------------------------------------------
  // Password Login Handler
  // ----------------------------------------------------
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your email, roll number, or username.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser(cleanId, password);
      if (!result.success) {
        setError(result.error || 'Invalid credentials. Please verify and try again.');
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Step 1: Send OTP for Password Reset
  // ----------------------------------------------------
  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanInput = identifier.trim().toLowerCase();
    if (!cleanInput) {
      setError('Please enter your roll number or registered email.');
      return;
    }

    let email = cleanInput;
    if (!cleanInput.includes('@')) {
      email = `${cleanInput}@cvr.ac.in`;
    }

    setTargetEmail(email);

    try {
      setLoading(true);
      const res = await requestEmailOtp(email, 'password_reset');
      if (res.success) {
        setForgotStep('verify_otp');
        setResendCooldown(45);
        setResetDigits(['', '', '', '', '', '']);
        setSuccessMessage(res.message || 'OTP sent to your email');
        setTimeout(() => {
          if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
        }, 150);
      } else {
        setError(res.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err) {
      setError('Unable to send OTP. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Step 2: Verify OTP
  // ----------------------------------------------------
  const handleOtpDigitChange = (index, val) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...resetDigits];
    newDigits[index] = val.slice(-1);
    setResetDigits(newDigits);
    setError('');

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !resetDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      setResetDigits(pasted.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const otpCode = resetDigits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit OTP sent to your email.');
      return;
    }

    try {
      setLoading(true);
      const verifyRes = await verifyEmailOtp(targetEmail, otpCode, 'password_reset');
      if (verifyRes.success && verifyRes.verified) {
        setResetToken(verifyRes.resetToken || 'verified');
        setForgotStep('new_password');
        setSuccessMessage('Email verified successfully! Please set your new password.');
      } else {
        setError(verifyRes.message || 'Invalid OTP. Please check and try again.');
        setResetDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
        }, 100);
      }
    } catch (err) {
      setError('Unable to verify OTP with server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    try {
      setResending(true);
      setError('');
      setResetDigits(['', '', '', '', '', '']);
      const res = await requestEmailOtp(targetEmail, 'password_reset');
      if (res.success) {
        setResendCooldown(45);
        setSuccessMessage(res.message || 'OTP sent to your email');
        setTimeout(() => {
          if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
        }, 100);
      } else {
        setError(res.message || 'Unable to resend OTP. Please try again.');
      }
    } catch (err) {
      setError('Failed to connect to OTP service.');
    } finally {
      setResending(false);
    }
  };

  // ----------------------------------------------------
  // Step 3: Set New Password (ONLY reachable after verified OTP)
  // ----------------------------------------------------
  const handleSaveNewPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      // Update password via AppContext & server with single-use resetToken
      const res = await changePassword(targetEmail, newPassword, resetToken);
      if (res.success) {
        setSuccessMessage('Password reset successfully! You can now sign in with your new password.');
        setPassword(newPassword);
        setNewPassword('');
        setConfirmNewPassword('');
        setResetDigits(['', '', '', '', '', '']);
        setResetToken('');
        setForgotStep('enter_email');
        setAuthMode('password');
      } else {
        setError(res.error || res.message || 'Failed to update password.');
      }
    } catch (err) {
      setError('Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0F19] text-gray-100">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center max-w-[240px] h-20 rounded-3xl p-1 shadow-glow mb-2 overflow-hidden">
            <img
              src="/images/deliz-main.png"
              alt="Deliz"
              className="w-full h-full object-contain drop-shadow-xl"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Deliz
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">
            Smart Campus Food Ordering • CVR Canteen
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111827] border border-gray-800 rounded-3xl p-6 sm:p-7 shadow-card-dark relative overflow-hidden">
          
          {/* Card Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">
                {authMode === 'password' ? 'Sign In with Password' : 'Reset Password'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {authMode === 'password'
                  ? 'Enter your email and password'
                  : 'Enter your registered email and set a new password'}
              </p>
            </div>

            {authMode === 'forgot_password' && (
              <button
                onClick={() => switchMode('password')}
                className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Sign In</span>
              </button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ==================================================== */}
          {/* 1. PURE PASSWORD LOGIN */}
          {/* ==================================================== */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  EMAIL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder=""
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none transition min-h-[46px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_password')}
                    className="text-[11px] text-orange-400 hover:text-orange-300 hover:underline font-semibold"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none transition min-h-[46px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 group disabled:opacity-50 min-h-[48px] active:scale-98"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span>Enter Deliz</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ==================================================== */}
          {/* 2. OTP-PROTECTED FORGOT PASSWORD RESET */}
          {/* ==================================================== */}
          {authMode === 'forgot_password' && (
            <div className="space-y-4">
              {/* STEP 1: Enter Email / Roll No */}
              {forgotStep === 'enter_email' && (
                <form onSubmit={handleSendResetOtp} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      EMAIL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder=""
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none transition min-h-[46px]"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      A 6-digit OTP code will be sent to your registered email to securely reset your password.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 group disabled:opacity-50 min-h-[48px] active:scale-98"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Send Verification OTP</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: Verify 6-Digit OTP */}
              {forgotStep === 'verify_otp' && (
                <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                  <div className="p-3 bg-orange-950/30 border border-orange-800/40 rounded-xl flex items-center justify-between">
                    <span className="text-xs text-orange-300">
                      Code sent to: <strong className="text-white">{targetEmail}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setForgotStep('enter_email')}
                      className="text-[11px] text-orange-400 hover:underline font-semibold"
                    >
                      Change Email
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-2 text-center">
                      Enter 6-Digit Verification Code *
                    </label>
                    <div className="flex justify-center gap-2 mb-2" onPaste={handleOtpPaste}>
                      {resetDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={el => (otpInputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold bg-gray-900 border-2 border-gray-700 rounded-xl text-orange-400 focus:border-orange-500 focus:outline-none transition"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || resetDigits.some(d => !d)}
                    className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 group disabled:opacity-50 min-h-[48px] active:scale-98"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying OTP...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify OTP</span>
                      </>
                    )}
                  </button>

                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1.5 pt-1">
                    <span>Didn't receive the code?</span>
                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      disabled={resendCooldown > 0 || resending}
                      className="text-orange-400 hover:text-orange-300 font-bold disabled:text-gray-600 transition"
                    >
                      {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Set New Password (ONLY IF OTP VERIFIED) */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleSaveNewPassword} className="space-y-4">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>OTP verified for <strong className="text-white">{targetEmail}</strong>. Set your new password below:</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      New Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimum 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none transition min-h-[46px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Repeat new password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-[#1F2937] border border-gray-700 rounded-xl text-white text-xs focus:border-orange-500 focus:outline-none transition min-h-[46px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-orange-400 transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 group disabled:opacity-50 min-h-[48px] active:scale-98"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving New Password...</span>
                      </>
                    ) : (
                      <>
                        <LockKeyhole className="w-4 h-4" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Create Account Link */}
          {authMode !== 'forgot_password' && (
            <div className="mt-5 pt-4 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-400">
                New Student?{' '}
                <button
                  onClick={onSwitchToSignUp}
                  className="text-orange-400 hover:text-orange-300 font-bold inline-flex items-center gap-1 hover:underline ml-1"
                >
                  <span>Create an Account</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
