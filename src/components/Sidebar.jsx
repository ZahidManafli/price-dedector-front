import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  User,
  Search,
  ShieldCheck,
  Moon,
  Sun,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const links = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Listings', path: '/listings', icon: Package },
    { label: 'Orders', path: '/orders', icon: Package },
    { label: 'Amazon Lookup', path: '/amazon-lookup', icon: Search },
     { label: 'eBay Calculator', path: '/ebay-calculator', icon: Calculator },
    { label: 'Settings', path: '/settings', icon: Settings },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', path: '/admin', icon: ShieldCheck }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 md:hidden bg-blue-600 text-white p-3 rounded-full shadow-lg z-40"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 h-screen w-64 bg-gray-900 dark:bg-slate-950 text-white transform transition-transform duration-300 z-30 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo-2.png" alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-slate-700/50" />
            <span className="text-xl font-semibold">Price Check</span>
          </div>

          <nav className="space-y-2">
            {links.map((link) => (
              // Icon component for current nav item.
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive(link.path)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <link.icon size={16} />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Profile footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.displayName || user?.email || 'User'}
              </p>
              {user?.email && (
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              )}
              <Link
                to="/settings"
                className="text-xs text-slate-300 hover:underline"
                onClick={() => setIsOpen(false)}
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>
          <button
            onClick={async () => {
              await logout();
              window.location.href = '/login';
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
