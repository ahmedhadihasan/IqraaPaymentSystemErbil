'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, TrendingUp, AlertCircle, Download, Calendar, UserCheck, UsersRound, Eye, ArrowRight } from 'lucide-react';
import { ku, formatIQD } from '@/lib/translations';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';

interface Student {
  id: string;
  name: string;
  gender: string;
  classTime?: string;
}

interface DashboardStats {
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  unpaidStudents: number;
  todayPayments: number;
  todayAmount: number;
  todayTransactions: Array<{
    id: string;
    amount: number;
    studentName: string;
    paymentDate: string;
    paymentType: string;
    siblingNames?: string;
    recordedByName?: string;
  }>;
  siblingPaymentsCount: number;
  siblingPaymentsAmount: number;
  recentPayments: Array<{
    id: string;
    amount: number;
    studentName: string;
    paymentDate: string;
    paymentType: string;
    recordedByName?: string;
  }>;
  collectionByAdmin?: Array<{
    adminId: string;
    adminName: string;
    amount: number;
  }>;
  periodCollection?: number;
  isSuperAdmin: boolean;
  adminClassTimes: string[];
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [isExporting, setIsExporting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboardStats', period],
    queryFn: async (): Promise<DashboardStats> => {
      const res = await fetch(`/api/dashboard/stats?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/students/export');
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const periodLabels = {
    today: ku.common.today,
    week: ku.dashboard.lastWeek,
    month: ku.dashboard.lastMonth,
    all: ku.dashboard.allTime,
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Students */}
        <div className="mobile-card col-span-2 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">
                {data?.isSuperAdmin ? ku.dashboard.totalStudents : ku.dashboard.myStudents}
              </p>
              <p className="text-3xl font-bold mt-1">
                {isLoading ? '...' : data?.totalStudents || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
              <span className="text-sm text-white/80">{ku.dashboard.maleStudents}:</span>
              <span className="font-bold">{isLoading ? '...' : data?.maleStudents || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-pink-400 rounded-full"></span>
              <span className="text-sm text-white/80">{ku.dashboard.femaleStudents}:</span>
              <span className="font-bold">{isLoading ? '...' : data?.femaleStudents || 0}</span>
            </div>
          </div>
        </div>

        {/* Unpaid Students Alert */}
        {(data?.unpaidStudents || 0) > 0 && (
          <div className="mobile-card col-span-2 bg-red-50 border border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-medium">{ku.dashboard.unpaidStudents}</p>
                <p className="text-2xl font-bold text-red-600">
                  {data?.unpaidStudents || 0}
                </p>
              </div>
              <Link href="/dashboard/students/my-students">
                <Button size="sm" variant="outline" className="border-red-300 text-red-600">
                  {ku.common.view}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Today's Payments */}
        <div className="mobile-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">{ku.dashboard.todayPayments}</p>
              <p className="text-xl font-bold text-gray-900">
                {isLoading ? '...' : data?.todayPayments || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Amount */}
        <div className="mobile-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">{ku.dashboard.todayCollection}</p>
              <p className="text-lg font-bold text-gray-900">
                {isLoading ? '...' : formatIQD(data?.todayAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Sibling Payments Today */}
        <Link href="/dashboard/payments/siblings" className="col-span-2">
          <div className="mobile-card bg-purple-50 border border-purple-200 active:bg-purple-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <UsersRound className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-purple-800 font-medium">پارەدانی خوشک و برا (ئەمڕۆ)</p>
                <div className="flex gap-4 mt-1">
                  <span className="text-sm text-purple-600">
                    {data?.siblingPaymentsCount || 0} پارەدان
                  </span>
                  <span className="text-sm font-bold text-purple-700">
                    {formatIQD(data?.siblingPaymentsAmount || 0)}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-400 rotate-180" />
            </div>
          </div>
        </Link>
      </div>

      {/* Super Admin: Collection by Admin */}
      {data?.isSuperAdmin && data.collectionByAdmin && data.collectionByAdmin.length > 0 && (
        <div className="mobile-card">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            {ku.dashboard.collectionByAdmin}
          </h3>
          <div className="space-y-2">
            {data.collectionByAdmin.map((admin) => (
              <div key={admin.adminId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-700">{admin.adminName}</span>
                <span className="font-bold text-green-600">{formatIQD(admin.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Super Admin: Period Collection Filter */}
      {data?.isSuperAdmin && (
        <div className="mobile-card">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {ku.dashboard.periodCollection}
          </h3>
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['today', 'week', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {period !== 'today' && (
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <p className="text-sm text-gray-600">{periodLabels[period]}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatIQD(data?.periodCollection || 0)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Payments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{ku.dashboard.recentPayments}</h2>
          <Link href="/dashboard/payments" className="text-primary text-sm font-medium">
            {ku.students.all}
          </Link>
        </div>
        
        <div className="space-y-2">
          {isLoading ? (
            // Loading skeleton
            [...Array(3)].map((_, i) => (
              <div key={i} className="mobile-card animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))
          ) : data?.recentPayments && data.recentPayments.length > 0 ? (
            data.recentPayments.map((payment) => (
              <div key={payment.id} className="mobile-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{payment.studentName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(payment.paymentDate).toLocaleDateString('ku-IQ')}
                      {data.isSuperAdmin && payment.recordedByName && (
                        <span className="mr-2 text-primary">• {payment.recordedByName}</span>
                      )}
                    </p>
                  </div>
                  <span className="font-bold text-green-600">{formatIQD(payment.amount)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state py-8">
              <CreditCard className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">{ku.payments.noPayments}</p>
            </div>
          )}
        </div>
      </div>

      {/* Today's Transactions */}
      {data?.todayTransactions && data.todayTransactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">پارەدانەکانی ئەمڕۆ</h2>
            <span className="text-sm text-gray-500">{data.todayTransactions.length} پارەدان</span>
          </div>
          
          <div className="space-y-2">
            {data.todayTransactions.map((payment) => (
              <div key={payment.id} className="mobile-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{payment.studentName}</p>
                    {payment.siblingNames && (
                      <p className="text-xs text-purple-600">+ {payment.siblingNames}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(payment.paymentDate).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
                      {payment.recordedByName && (
                        <span className="mr-2">• {payment.recordedByName}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-green-600">{formatIQD(payment.amount)}</span>
                    <p className="text-xs text-gray-400">
                      {payment.paymentType === 'family' ? 'خوشک و برا' : payment.paymentType === 'single' ? 'تاک' : payment.paymentType}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <RecordPaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedStudent(null);
        }}
        onSuccess={() => {
          setShowPaymentModal(false);
          setSelectedStudent(null);
          refetch();
        }}
        preselectedStudent={selectedStudent}
      />
    </div>
  );
}
