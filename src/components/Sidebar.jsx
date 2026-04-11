import React, { useEffect, useState } from 'react';
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
  Code2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { ebayAPI } from '../services/api';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [activeEbayLabel, setActiveEbayLabel] = useState(null);

  const links = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Listings', path: '/listings', icon: Package },
    { label: 'Orders', path: '/orders', icon: Package },
    { label: 'Amazon Lookup', path: '/amazon-lookup', icon: Search },
     { label: 'eBay Calculator', path: '/ebay-calculator', icon: Calculator },
    { label: 'Checkila Analysis', path: '/market-analysis', icon: BarChart3 },
    { label: 'Dewiso', path: '/dewiso', icon: Code2 },
    { label: 'Settings', path: '/settings', icon: Settings },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', path: '/admin', icon: ShieldCheck }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await ebayAPI.getStatus();
        const status = res?.data || {};
        const label = status?.activeAccountLabel || status?.accountId || null;
        if (!cancelled) setActiveEbayLabel(label);
      } catch {
        if (!cancelled) setActiveEbayLabel(null);
      }
    };
    load();

    const handleEbayUpdated = () => {
      load();
    };

    window.addEventListener('ebay:updated', handleEbayUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('ebay:updated', handleEbayUpdated);
    };
  }, [user?.uid]);

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
        className={`fixed left-0 h-screen md:relative md:h-auto bg-gray-900 dark:bg-slate-950 text-white transition-all duration-300 z-30 md:z-auto flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`flex-shrink-0 flex items-center ${
          isCollapsed ? 'justify-center px-2 py-6' : 'justify-between px-4 py-4'
        }`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 w-full">
              <img src="/logo-2.png" alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-slate-700/50 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block text-lg font-semibold">Checkila</span>
                {activeEbayLabel ? (
                  <span className="block text-xs text-slate-300 truncate">
                    eBay: <span className="font-medium text-slate-100">{activeEbayLabel}</span>
                  </span>
                ) : (
                  <span className="block text-xs text-slate-400 truncate">eBay: —</span>
                )}
              </div>
            </div>
          )}
          {isCollapsed && (
            <img src="/logo-2.png" alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-slate-700/50" />
          )}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center justify-center p-1 hover:bg-slate-800 rounded transition flex-shrink-0"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto" style={{ paddingLeft: isCollapsed ? '0.5rem' : '1rem', paddingRight: isCollapsed ? '0.5rem' : '1rem' }}>
          <div className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition ${
                  isCollapsed ? 'justify-center' : ''
                } ${
                  isActive(link.path)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
                title={isCollapsed ? link.label : ''}
              >
                <link.icon size={18} className="flex-shrink-0" />
                {!isCollapsed && <span className="text-sm">{link.label}</span>}
              </Link>
            ))}
          </div>
        </nav>

        {/* Profile footer */}
        <div className="flex-shrink-0 p-3 border-t border-slate-700">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
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
              <div className="flex gap-2">
                <button
                  onClick={toggleTheme}
                  className="flex-1 flex items-center justify-center gap-2 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
                  title={isDark ? 'Light mode' : 'Dark mode'}
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                  onClick={async () => {
                    await logout();
                    window.location.href = '/login';
                  }}
                  className="flex-1 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 transition"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = '/login';
                }}
                className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 transition"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
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
