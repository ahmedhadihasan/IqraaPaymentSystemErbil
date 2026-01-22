'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Menu, 
  X, 
  LogOut,
  Shield,
  ChevronLeft
} from 'lucide-react';
import { ku } from '@/lib/translations';

export function MobileHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'super_admin';

  return (
    <>
      {/* Header Bar */}
      <header className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow">
            <img src="/logo.jpg" alt={ku.appName} className="w-full h-full object-cover" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{ku.appName}</h1>
        </div>
        
        <button
          onClick={() => setIsMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      </header>

      {/* Full screen menu overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#1e3a5f] animate-slide-up">
          <div className="flex flex-col h-full safe-top">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shadow-lg">
                  <img src="/logo.jpg" alt={ku.appName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{ku.appName}</h1>
                  <p className="text-xs text-white/60">{ku.appTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-white/10">
              <p className="text-white font-medium">{session?.user?.name}</p>
              <p className="text-sm text-white/60">{session?.user?.email}</p>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg">
                  <Shield className="w-3 h-3" />
                  {ku.admins.superAdmin}
                </span>
              )}
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-4 space-y-2">
              {isSuperAdmin && (
                <Link
                  href="/dashboard/admins"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-4 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">{ku.nav.admins}</span>
                  <ChevronLeft className="w-5 h-5 mr-auto" />
                </Link>
              )}
            </nav>

            {/* Logout */}
            <div className="p-4 safe-bottom">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">{ku.nav.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
