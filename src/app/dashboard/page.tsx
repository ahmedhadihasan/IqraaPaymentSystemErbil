'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, CreditCard, TrendingUp, AlertCircle, Download, Calendar, UserCheck, UsersRound, Eye, ArrowRight, BarChart3 } from 'lucide-react';
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
  studentCollection?: number;
  bookCollection?: number;
  isSuperAdmin: boolean;
  adminClassTimes: string[];
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboardStats', period, startDate, endDate],
    queryFn: async (): Promise<DashboardStats> => {
      const query = new URLSearchParams({ period });
      if (period === 'custom' && startDate && endDate) {
        query.append('startDate', startDate);
        query.append('endDate', endDate);
      }
      const res = await fetch(`/api/dashboard/stats?${query.toString()}`);
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
    today: 'ئەمڕۆ',
    week: 'ئەم هەفتەیە (شەممە - هەینی)',
    month: 'ئەم مانگە',
    custom: 'ماوەی دیاریکراو',
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

        {/* Forgiven Students Card */}
        <Link href="/dashboard/students/forgiven" className="col-span-2">
          <div className="mobile-card bg-amber-50 border border-amber-200 active:bg-amber-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-amber-800 font-medium">خوێندکارە لێخۆشبووەکان</p>
                <p className="text-sm text-amber-600">بەڕێوەبردنی ئەو خوێندکارانەی لێیان خۆشبووین</p>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-400 rotate-180" />
            </div>
          </div>
        </Link>

        {/* SuperAdmin: Collection Report Link */}
        {data?.isSuperAdmin && (
          <Link href="/dashboard/reports/collection" className="col-span-2">
            <div className="mobile-card bg-indigo-50 border border-indigo-200 active:bg-indigo-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-indigo-800 font-medium">ڕاپۆرتی کۆکراوە</p>
                  <p className="text-sm text-indigo-600">پشکنینی کۆکراوەکان بەپێی پۆل</p>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-400 rotate-180" />
              </div>
            </div>
          </Link>
        )}

        {/* Today's Payments Quick Stats */}
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
      </div>

      {/* Collection Split & Periods - For all users */}
      {data && (
        <div className="mobile-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              کۆکراوە بەپێی ماوە
            </h3>
          </div>
          
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
            {(['today', 'week', 'month', 'custom', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  period === p
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">لە بەرواری</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">بۆ بەرواری</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs border rounded-lg p-2"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Total Card */}
            <Link 
              href={`/dashboard/payments?period=${period}${period === 'custom' ? `&startDate=${startDate}&endDate=${endDate}` : ''}`}
            >
              <div className="p-4 bg-green-500 text-white rounded-2xl shadow-sm active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 text-sm font-medium">کۆکراوەی گشتی ({periodLabels[period]})</span>
                  <ArrowRight className="w-4 h-4 rotate-180 opacity-60" />
                </div>
                <p className="text-2xl font-bold mt-1">
                  {formatIQD((data?.studentCollection || 0) + (data?.bookCollection || 0))}
                </p>
              </div>
            </Link>

            {/* Split Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/dashboard/payments?type=single&period=${period}${period === 'custom' ? `&startDate=${startDate}&endDate=${endDate}` : ''}`}>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl active:bg-blue-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-600 text-xs font-medium">خوێندکاران</p>
                    <ArrowRight className="w-3 h-3 text-blue-400 rotate-180" />
                  </div>
                  <p className="text-lg font-bold text-blue-900 mt-1">
                    {formatIQD(data?.studentCollection || 0)}
                  </p>
                </div>
              </Link>
              <Link href="/dashboard/books">
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl h-full active:bg-purple-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-purple-600 text-xs font-medium">کتێبەکان</p>
                    <ArrowRight className="w-3 h-3 text-purple-400 rotate-180" />
                  </div>
                  <p className="text-lg font-bold text-purple-900 mt-1">
                    {formatIQD(data?.bookCollection || 0)}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

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

      {/* Recent Payments */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">{ku.dashboard.recentPayments}</h2>
          <Link href="/dashboard/payments" className="text-primary text-sm font-medium">
            {ku.students.all}
          </Link>
        </div>
        
        <div className="space-y-2">
          {isLoading ? (
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
                      {new Date(payment.paymentDate).toLocaleDateString('en-GB')}
                      {data.isSuperAdmin && payment.recordedByName && (
                        <span className="mr-2 text-primary">• {payment.recordedByName}</span>
                      )}
                    </p>
                  </div>
                  {payment.amount === 0 ? (
                    <span className="font-bold text-amber-600">بەخۆڕایی</span>
                  ) : (
                    <span className="font-bold text-green-600">{formatIQD(payment.amount)}</span>
                  )}
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

      {/* Record Payment Modal */}
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
