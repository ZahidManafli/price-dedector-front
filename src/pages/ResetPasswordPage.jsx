import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import Swal from 'sweetalert2';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid link',
        text: 'This reset link is invalid. Please request a new one.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      }).then(() => navigate('/forgot-password'));
      return;
    }

    if (!newPassword || !confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Fields required',
        text: 'Please fill in both password fields.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
      return;
    }

    if (newPassword.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Password too short',
        text: 'Password must be at least 8 characters.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Passwords do not match',
        text: 'Please make sure both passwords are the same.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
      return;
    }

    try {
      setLoading(true);
      await authAPI.resetPassword(token, newPassword);
      Swal.fire({
        icon: 'success',
        title: 'Password updated!',
        text: 'Your password has been reset successfully. You can now log in with your new password.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      }).then(() => navigate('/login'));
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Reset failed',
        text: error?.response?.data?.error || 'This link may have expired. Please request a new reset link.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-6 ${
      isDark
        ? 'bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900'
        : 'bg-gradient-to-b from-slate-50 to-indigo-50'
    }`}>
      <div className={`p-6 w-full max-w-md rounded-2xl border shadow-sm ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="text-center mb-6">
          <img
            src="/logo-2.png"
            alt="Checkila"
            className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-sm border border-slate-300/40"
          />
          <h1 className={`text-2xl font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Set New Password
          </h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Enter and confirm your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password (min. 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 outline-none transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
            }`}
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 outline-none transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
            }`}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-2.5"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={`text-sm font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
