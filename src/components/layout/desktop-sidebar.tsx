'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  UsersRound,
  CreditCard, 
  Settings,
  LogOut,
  Shield
} from 'lucide-react';
import { ku } from '@/lib/translations';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isSuperAdmin = session?.user?.role === 'super_admin';

  const navItems = [
    { href: '/dashboard', icon: Home, label: ku.nav.dashboard },
    { href: '/dashboard/students/my-students', icon: Users, label: ku.nav.myStudents },
    { href: '/dashboard/students', icon: UsersRound, label: ku.nav.allStudents, superAdminOnly: false },
    { href: '/dashboard/payments', icon: CreditCard, label: ku.nav.payments },
    { href: '/dashboard/settings', icon: Settings, label: ku.nav.settings },
  ];

  return (
    <aside className="fixed top-0 right-0 h-screen w-64 bg-[#1e3a5f] text-white flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shadow-lg">
            <img src="/logo.jpg" alt={ku.appName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{ku.appName}</h1>
            <p className="text-xs text-white/60">{ku.appTitle}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && item.href !== '/dashboard/students/my-students' && pathname.startsWith(item.href) && !pathname.includes('/my-students'));
          
          // Skip if super admin only and user is not super admin
          if (item.superAdminOnly && !isSuperAdmin) return null;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive || (item.href === '/dashboard/students/my-students' && pathname.includes('/my-students'))
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Admin management - super admin only */}
        {isSuperAdmin && (
          <Link
            href="/dashboard/admins"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              pathname.startsWith('/dashboard/admins')
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="font-medium">{ku.nav.admins}</span>
          </Link>
        )}
      </nav>

      {/* User info & logout */}
      <div className="p-4 border-t border-white/10">
        <div className="mb-3 px-4">
          <p className="text-sm font-medium truncate">{session?.user?.name}</p>
          <p className="text-xs text-white/60 truncate">{session?.user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">{ku.nav.logout}</span>
        </button>
      </div>
    </aside>
  );
}
