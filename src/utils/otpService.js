import { sendOtp, verifyOtp, resetPasswordWithToken } from './supabaseClient';

export const requestEmailOtp = async (email, purpose = 'registration') => {
  try {
    if (!email || !email.trim()) {
      return {
        success: false,
        message: 'Email address is required.'
      };
    }

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@cvr.ac.in`;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return {
        success: false,
        message: 'Please enter a valid email address.'
      };
    }

    const res = await sendOtp(cleanEmail, purpose);
    return {
      success: res.success,
      message: res.message || res.error || (res.success ? 'OTP sent to your email' : 'Unable to send OTP. Please try again.'),
    };
  } catch (err) {
    console.error('Failed to request OTP:', err);
    return {
      success: false,
      message: 'Unable to connect to OTP verification service.'
    };
  }
};

export const verifyEmailOtp = async (email, otp, purpose = 'registration') => {
  try {
    if (!email || !otp) {
      return {
        success: false,
        verified: false,
        message: 'Email and 6-digit OTP are required.'
      };
    }

    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@cvr.ac.in`;
    }
    const res = await verifyOtp(cleanEmail, otp.trim(), purpose);
    return {
      success: res.success,
      verified: Boolean(res.verified || res.success),
      resetToken: res.resetToken,
      user: res.user,
      session: res.session,
      message: res.message || res.error || (res.success ? 'OTP verified successfully!' : 'Invalid or expired OTP.'),
    };
  } catch (err) {
    console.error('Failed to verify OTP:', err);
    return {
      success: false,
      verified: false,
      message: 'Unable to verify OTP with server.'
    };
  }
};

export const submitPasswordReset = async (email, resetToken, newPassword) => {
  try {
    if (!email || !newPassword) {
      return { success: false, message: 'Email and new password are required.' };
    }
    let cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@cvr.ac.in`;
    }
    return await resetPasswordWithToken(cleanEmail, resetToken, newPassword);
  } catch (err) {
    console.error('Failed to reset password:', err);
    return { success: false, message: 'Server error resetting password.' };
  }
};
