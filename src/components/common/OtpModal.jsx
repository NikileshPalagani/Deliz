import React, { useState, useEffect, useRef } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Key } from 'lucide-react';
import { verifyEmailOtp, requestEmailOtp } from '../../utils/otpService';

export const OtpModal = ({ isOpen, onClose, email, purpose = 'Verification', onVerified, initialOtpResult = null }) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(45);
  const [resending, setResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setError('');
      setResendCooldown(45);
      
      if (initialOtpResult) {
        setInfoMessage(initialOtpResult.message || `Verification code emailed to ${email}. Check your inbox or spam.`);
      } else {
        // Request OTP if not already sent beforehand
        (async () => {
          setResending(true);
          try {
            const res = await requestEmailOtp(email, purpose);
            if (!isMounted) return;
            if (res.success) {
              setInfoMessage(res.message || `A 6-digit verification code has been emailed to ${email}.`);
            } else {
              setError(res.message || 'Failed to dispatch verification code. Please check your network or try again.');
            }
          } catch (err) {
            if (isMounted) {
              setError('Failed to dispatch verification code. Please try again.');
            }
          } finally {
            if (isMounted) {
              setResending(false);
            }
          }
        })();
      }

      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 150);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, email, initialOtpResult, purpose]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0 && isOpen) {
      timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown, isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const chars = pasted.split('');
      setDigits(chars);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    const otpCode = digits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await verifyEmailOtp(email, otpCode, purpose);
      if (res.success && res.verified) {
        onVerified(res);
      } else {
        setError(res.message || 'Invalid or expired verification code.');
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          if (inputRefs.current[0]) inputRefs.current[0].focus();
        }, 100);
      }
    } catch (err) {
      setError('Failed to verify OTP with server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    try {
      setResending(true);
      setError('');
      setDigits(['', '', '', '', '', '']);
      const res = await requestEmailOtp(email, purpose);
      if (res.success) {
        setResendCooldown(45);
        setInfoMessage(res.message || 'OTP sent to your email');
        setTimeout(() => {
          if (inputRefs.current[0]) inputRefs.current[0].focus();
        }, 100);
      } else {
        setError(res.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err) {
      setError('Failed to connect to OTP service.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#111827] border border-gray-800 w-full max-w-md rounded-3xl p-5 sm:p-7 shadow-2xl relative text-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 mb-3 shadow-glow">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-black tracking-tight text-white mb-0.5">
            Email Verification Code
          </h3>
          <p className="text-xs text-gray-400 mb-2">
            Verifying: <span className="font-bold text-orange-400">{email}</span>
          </p>
          
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-2.5 text-[11px] text-gray-400 mb-4 flex items-start gap-2 text-left w-full">
            <Mail className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
            <span>Check your inbox or Spam folder for the 6-digit passcode.</span>
          </div>

          {infoMessage && (
            <div className="mb-3 text-xs text-orange-300 bg-orange-950/40 border border-orange-800/60 rounded-lg px-3 py-2 w-full text-center">
              {infoMessage}
            </div>
          )}

          {error && (
            <div className="mb-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg px-3 py-2 w-full flex items-center justify-center gap-1.5 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 6 Digit Input Boxes */}
          <form onSubmit={handleVerify} className="w-full">
            <div className="flex justify-center gap-2 mb-5" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={el => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold bg-gray-900 border-2 border-gray-700 rounded-xl text-orange-400 focus:border-orange-500 focus:outline-none transition"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || digits.some(d => !d)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 min-h-[46px] active:scale-98"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying OTP...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify & Proceed</span>
                </>
              )}
            </button>
          </form>

          {/* Resend Action */}
          <div className="mt-4 text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <span>Didn't get code?</span>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="text-orange-400 hover:text-orange-300 font-bold disabled:text-gray-600 transition"
            >
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
