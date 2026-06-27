import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import Swal from 'sweetalert2';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Email required',
        text: 'Please enter your email address.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      });
      return;
    }

    try {
      setLoading(true);
      await authAPI.forgotPassword(email.trim());
      Swal.fire({
        icon: 'success',
        title: 'Email sent!',
        text: 'A password reset link has been sent to your email. Please check your inbox.',
        confirmButtonColor: '#2563eb',
        background: isDark ? '#1e293b' : '#fff',
        color: isDark ? '#f1f5f9' : '#1e293b',
      }).then(() => navigate('/login'));
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404) {
        Swal.fire({
          icon: 'error',
          title: 'Account not found',
          text: 'There is no account registered with this email address.',
          confirmButtonColor: '#2563eb',
          background: isDark ? '#1e293b' : '#fff',
          color: isDark ? '#f1f5f9' : '#1e293b',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Something went wrong',
          text: error?.response?.data?.error || 'Failed to send reset email. Please try again.',
          confirmButtonColor: '#2563eb',
          background: isDark ? '#1e293b' : '#fff',
          color: isDark ? '#f1f5f9' : '#1e293b',
        });
      }
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
            Forgot Password
          </h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Sending...' : 'Send Reset Link'}
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
