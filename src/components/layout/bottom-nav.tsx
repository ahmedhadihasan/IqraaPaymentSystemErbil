'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  Home, 
  Users, 
  CreditCard, 
  Settings,
  Plus,
  BookOpen,
  UsersRound
} from 'lucide-react';
import { ku } from '@/lib/translations';
import { isSuperAdminRole } from '@/lib/permissions';

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminRole(session?.user?.role || '');

  // Different nav items based on role
  const navItems = [
    { href: '/dashboard', icon: Home, label: ku.nav.dashboard },
    // Super admin sees all students, regular admin sees my-students
    isSuperAdmin 
      ? { href: '/dashboard/students', icon: UsersRound, label: ku.nav.allStudents }
      : { href: '/dashboard/students/my-students', icon: Users, label: ku.nav.myStudents },
    { href: '/dashboard/payments', icon: CreditCard, label: ku.nav.payments },
    { href: '/dashboard/books', icon: BookOpen, label: ku.nav.books },
    { href: '/dashboard/settings', icon: Settings, label: ku.nav.settings },
  ];

  return (
    <nav className="bottom-nav z-50 md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href.includes('/students') && pathname.includes('/students'));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] rounded-lg transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium leading-tight text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Floating action button for adding payments
export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fab md:hidden"
      aria-label={ku.payments.recordPayment}
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
