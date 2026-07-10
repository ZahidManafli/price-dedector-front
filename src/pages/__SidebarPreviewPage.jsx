import React from 'react';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { SidebarProvider } from '../context/SidebarContext';
import { TourProvider } from '../context/TourContext';
import Sidebar from '../components/Sidebar';

const mockUser = {
  name: 'Jane',
  surname: 'Doe',
  email: 'jane.doe@example.com',
  role: 'admin',
  permissions: { referralAdmin: true },
};

const mockAuthValue = {
  user: mockUser,
  isAuthenticated: true,
  loading: false,
  error: null,
  maintenance: null,
  logout: async () => {},
  hasTabAccess: () => true,
};

export default function SidebarPreviewPage() {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      <LanguageProvider>
        <SidebarProvider>
          <TourProvider>
            <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
              <Sidebar />
              <main className="flex-1 p-8 text-slate-500 dark:text-slate-400">Preview area</main>
            </div>
          </TourProvider>
        </SidebarProvider>
      </LanguageProvider>
    </AuthContext.Provider>
  );
}
