import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { setSession } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [registerOpen, setRegisterOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!formData.email || !formData.password) {
      setAlert({ type: 'error', message: 'Please fill all fields' });
      return;
    }

    try {
      setLoading(true);

      const response = await authAPI.login(formData.email, formData.password);
      const token = response?.data?.token;
      const user = response?.data?.user;

      if (!token) {
        throw new Error('Login failed: missing token');
      }

      localStorage.setItem('authToken', token);
      if (user) {
        setSession(user, token);
      } else {
        setSession({ email: formData.email, role: 'user' }, token);
      }

      setAlert({ type: 'success', message: 'Login successful!' });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || error?.response?.data?.error || error.message || 'Login failed';
      setAlert({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const openRegister = async () => {
    setRegisterOpen(true);
    if (plans.length > 0) return;
    try {
      const response = await settingsAPI.getPublicPlans();
      setPlans(response?.data?.plans || []);
    } catch {
      setPlans([]);
    }
  };

  const onRequestSuccess = () => {
    Swal.fire({
      icon: 'success',
      title: 'Request Sent',
      text: 'Your request is seen. Admin will reach you soon.',
      confirmButtonColor: '#2563eb',
    });
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-6 ${
      isDark
        ? 'bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900'
        : 'bg-gradient-to-b from-slate-50 to-indigo-50'
    }`}>
      <div className={`p-6 w-full max-w-md rounded-2xl border shadow-sm ${
        isDark
          ? 'bg-slate-900 border-slate-700'
          : 'bg-white border-slate-200'
      }`}>
        <div className="text-center mb-6">
          <img
            src="/logo-2.png"
            alt="Checkila"
            className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-sm border border-slate-300/40"
          />
          <h1 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Welcome back
          </h1>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mt-2`}>
            Sign in to Checkila to manage pricing and automation
          </p>
        </div>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
              autoClose={false}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full rounded-lg border px-3 py-2 outline-none transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
            }`}
            disabled={loading}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
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
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className={`mt-6 text-center text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <p>Don&apos;t have an account?</p>
          <button
            type="button"
            onClick={openRegister}
            className="mt-2 font-semibold text-blue-600 hover:text-blue-700"
          >
            Register
          </button>
        </div>
      </div>

      <SubscriptionRequestModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        plans={plans}
        lockPlan={false}
        onSuccess={onRequestSuccess}
      />
    </div>
  );
}
