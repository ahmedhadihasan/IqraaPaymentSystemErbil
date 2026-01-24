'use client';

import { useQuery } from '@tanstack/react-query';
import { UsersRound, ArrowRight, UserCheck, Calendar } from 'lucide-react';
import { ku, formatIQD } from '@/lib/translations';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SiblingPayment {
  id: string;
  amount: number;
  studentName: string;
  siblingNames: string;
  paymentDate: string;
  recordedByName: string;
}

export default function SiblingsPaymentsPage() {
  const { data: siblings, isLoading } = useQuery({
    queryKey: ['siblingPayments'],
    queryFn: async (): Promise<SiblingPayment[]> => {
      const res = await fetch('/api/dashboard/stats'); // We'll adapt the stats response or create a new endpoint if needed
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      // For now, filter transactions that are family related or use a specific property
      return data.todayTransactions?.filter((t: any) => t.paymentType === 'family' || t.siblingNames) || [];
    },
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
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse h-24 bg-gray-100 rounded-xl"></div>
          ))
        ) : siblings && siblings.length > 0 ? (
          siblings.map((payment) => (
            <div key={payment.id} className="mobile-card bg-purple-50 border border-purple-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{payment.studentName}</h3>
                  <p className="text-sm text-purple-700 font-medium">خوشک و براکان: {payment.siblingNames}</p>
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
            <p className="text-gray-500">هیچ پارەدانێکی خوشک و برا بۆ ئەمڕۆ نییە</p>
          </div>
        )}
      </div>
    </div>
  );
}
