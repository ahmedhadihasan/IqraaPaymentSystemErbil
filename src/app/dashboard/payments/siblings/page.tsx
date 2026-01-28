'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { 
  UsersRound, 
  ArrowRight, 
  UserCheck, 
  Calendar,
  Filter,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import Link from 'next/link';
import { CLASS_TIMES } from '@/lib/billing';

interface Payment {
  id: string;
  amount: number;
  studentName: string;
  studentClassTime?: string;
  siblingNames: string;
  paymentDate: string;
  recordedByName: string;
}

export default function SiblingsPaymentsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'super_admin';
  
  const [classFilter, setClassFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments-siblings'],
    queryFn: async () => {
      const res = await fetch('/api/payments?type=family');
      if (!res.ok) throw new Error('Failed to fetch payments');
      const data = await res.json();
      return data.payments || [];
    },
  });

  const filteredPayments = payments.filter((p: Payment) => {
     const matchesClass = classFilter === 'all' || p.studentClassTime === classFilter;
     const matchesSearch = p.studentName.toLowerCase().includes(search.toLowerCase()) || 
                           (p.siblingNames && p.siblingNames.toLowerCase().includes(search.toLowerCase()));
     return matchesClass && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">زانیارییەکانی خوشک و برا</h1>
        </div>
        <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
          {filteredPayments.length} پارەدان
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="search"
            placeholder="گەڕان بە ناو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mobile-input pr-10"
          />
        </div>
        
        {isSuperAdmin && (
          <div className="relative">
             <select
               value={classFilter}
               onChange={(e) => setClassFilter(e.target.value)}
               className="h-12 px-4 pr-10 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium appearance-none outline-none focus:ring-2 focus:ring-primary/20"
             >
               <option value="all">هەموو کاتەکان</option>
               {CLASS_TIMES.map((time) => (
                 <option key={time} value={time}>
                   {ku.classTimes[time] || time}
                 </option>
               ))}
             </select>
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse h-24 bg-gray-100 rounded-xl"></div>
          ))
        ) : filteredPayments.length > 0 ? (
          filteredPayments.map((payment: Payment) => (
            <div key={payment.id} className="mobile-card bg-purple-50 border border-purple-100 animate-scale-up">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{payment.studentName}</h3>
                  <p className="text-sm text-purple-700 font-medium">خوشک و براکان: {payment.siblingNames}</p>
                  {isSuperAdmin && payment.studentClassTime && (
                    <span className="inline-block mt-1 text-xs bg-white/50 px-2 py-0.5 rounded text-purple-600 border border-purple-100">
                      {ku.classTimes[payment.studentClassTime as keyof typeof ku.classTimes] || payment.studentClassTime}
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold text-green-600 bg-white px-3 py-1 rounded-lg border border-green-100">
                  {formatIQD(payment.amount)}
                </span>
              </div>
              
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-purple-200/50">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-4 h-4" />
                  {new Date(payment.paymentDate).toLocaleDateString('ku-IQ')}
                </div>
                {payment.recordedByName && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <UserCheck className="w-4 h-4" />
                    {payment.recordedByName}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state py-12">
            <UsersRound className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">هیچ پارەدانێکی خوشک و برا نییە</p>
          </div>
        )}
      </div>
    </div>
  );
}
