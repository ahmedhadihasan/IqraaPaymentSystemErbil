'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  CreditCard, 
  Settings,
  Plus,
  BookOpen
} from 'lucide-react';
import { ku } from '@/lib/translations';

const navItems = [
  { href: '/dashboard', icon: Home, label: ku.nav.dashboard },
  { href: '/dashboard/students/my-students', icon: Users, label: ku.nav.myStudents },
  { href: '/dashboard/payments', icon: CreditCard, label: ku.nav.payments },
  { href: '/dashboard/books', icon: BookOpen, label: ku.nav.books },
  { href: '/dashboard/settings', icon: Settings, label: ku.nav.settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav z-50 md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/dashboard/students/my-students' && pathname.includes('/students'));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-3 min-w-[64px] rounded-xl transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
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
