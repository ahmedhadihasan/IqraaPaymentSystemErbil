'use client';

import { signOut, useSession } from 'next-auth/react';
import { 
  User, 
  LogOut, 
  Shield, 
  Moon,
  Bell,
  HelpCircle,
  ChevronLeft,
  Info
} from 'lucide-react';
import { ku } from '@/lib/translations';

export default function SettingsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'super_admin';

  const settingsGroups = [
    {
      title: 'حساب',
      items: [
        {
          icon: User,
          label: session?.user?.name || 'بەڕێوەبەر',
          subtitle: session?.user?.email,
          badge: isSuperAdmin ? ku.admins.superAdmin : ku.admins.admin,
        },
      ],
    },
    {
      title: 'زانیاری',
      items: [
        {
          icon: Info,
          label: 'دەربارەی سیستەم',
          subtitle: 'وەشانی ١.٠.٠',
          badge: undefined as string | undefined,
        },
        {
          icon: HelpCircle,
          label: 'یارمەتی',
          subtitle: 'پرسیارە باوەکان',
          badge: undefined as string | undefined,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="mobile-card bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{session?.user?.name}</h2>
            <p className="text-white/80 text-sm">{session?.user?.email}</p>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg">
                <Shield className="w-3 h-3" />
                {ku.admins.superAdmin}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Groups */}
      {settingsGroups.map((group, i) => (
        <div key={i}>
          <h3 className="text-sm font-medium text-gray-500 mb-2 px-1">{group.title}</h3>
          <div className="mobile-card divide-y divide-gray-100">
            {group.items.map((item, j) => (
              <div key={j} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{item.label}</p>
                  {item.subtitle && (
                    <p className="text-sm text-gray-500 truncate">{item.subtitle}</p>
                  )}
                </div>
                {item.badge && (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg font-medium">
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Logout Button */}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="w-full mobile-card flex items-center justify-center gap-3 py-4 text-red-600 font-medium"
      >
        <LogOut className="w-5 h-5" />
        {ku.nav.logout}
      </button>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 py-4">
        <p>© 2026 {ku.appName}</p>
        <p className="mt-1">رێکخراوی اقرا - لقی هەولێر @2026</p>
      </div>
      
        {/* Danger Zone for Super Admin */}
        {isSuperAdmin && (
          <div className="mobile-card bg-red-50 border border-red-200 mt-8">
            <h3 className="text-lg font-bold text-red-700 mb-4">Danger Zone</h3>
            <div className="space-y-3">
              <button
                className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                onClick={async () => {
                  if (confirm('Are you sure you want to delete ALL students?')) {
                    await fetch('/api/superadmin/danger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'students' }),
                    });
                    window.location.reload();
                  }
                }}
              >Delete ALL Students</button>
              <button
                className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                onClick={async () => {
                  if (confirm('Are you sure you want to delete ALL admins except superadmin?')) {
                    await fetch('/api/superadmin/danger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'admins' }),
                    });
                    window.location.reload();
                  }
                }}
              >Delete ALL Admins (except superadmin)</button>
              <button
                className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                onClick={async () => {
                  if (confirm('Are you sure you want to delete ALL payments?')) {
                    await fetch('/api/superadmin/danger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'payments' }),
                    });
                    window.location.reload();
                  }
                }}
              >Delete ALL Payments</button>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Admin ID for payments"
                  id="danger-admin-id"
                  className="flex-1 py-2 px-3 rounded-xl border border-gray-300"
                />
                <button
                  className="py-2 px-4 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                  onClick={async () => {
                    const adminId = (document.getElementById('danger-admin-id') as HTMLInputElement)?.value;
                    if (adminId && confirm('Delete all payments for this admin?')) {
                      await fetch('/api/superadmin/danger', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'paymentsByAdmin', adminId }),
                      });
                      window.location.reload();
                    }
                  }}
                >Delete Payments for Admin</button>
              </div>
              <button
                className="w-full py-3 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 mt-4"
                onClick={async () => {
                  if (confirm('Are you sure you want to DELETE EVERYTHING except superadmin?')) {
                    await fetch('/api/superadmin/danger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'all' }),
                    });
                    window.location.reload();
                  }
                }}
              >Delete EVERYTHING (except superadmin)</button>
            </div>
          </div>
        )}
    </div>
  );
}
