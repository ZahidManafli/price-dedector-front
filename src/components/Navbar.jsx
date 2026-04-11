import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Settings, UserCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ').trim() || user?.fullName || user?.email || 'Account';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
            <img src="/logo-2.png" alt="Checkila" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-semibold text-lg text-slate-900">Checkila</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-4 ml-auto">
            {/* User Info */}
            <div className="hidden md:flex flex-col items-end text-sm leading-tight">
              <span className="font-medium text-slate-900">{displayName}</span>
              <span className="text-slate-600">{user?.email}</span>
            </div>

            {/* Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold hover:bg-blue-700 transition"
              >
                <UserCircle2 size={18} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                  <Link
                    to="/settings"
                    className="px-4 py-2.5 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 border-t border-slate-100 flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
