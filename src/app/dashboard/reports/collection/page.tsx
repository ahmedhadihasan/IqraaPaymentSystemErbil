'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  CreditCard, 
  UserCheck,
  Calendar,
  ChevronDown,
  TrendingUp,
  Check,
  X,
  User
} from 'lucide-react';
import { ku, formatIQD } from '@/lib/translations';
import { CLASS_TIMES, PRICING, SEMESTER } from '@/lib/billing';
import { cn } from '@/lib/utils';

interface AdminCollection {
  adminId: string;
  adminName: string;
  amount: number;
}

interface ClassStats {
  classTime: string;
  totalStudents: number;
  paidStudents: number;
  unpaidStudents: number;
  forgivenStudents: number;
  totalCollected: number;
  expectedCollection: number;
}

interface ReportData {
  classes: ClassStats[];
  overallStats: {
    totalStudents: number;
    paidStudents: number;
    unpaidStudents: number;
    forgivenStudents: number;
    totalCollected: number;
    expectedCollection: number;
  };
  bookCollection: number;
  collectionByAdmin: AdminCollection[];
}

async function fetchReportData(period: string, startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  query.set('period', period);
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  
  const res = await fetch(`/api/superadmin/report?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

export default function CollectionReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'semester' | 'custom'>('semester');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isSuperAdmin = session?.user?.role === 'super_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['collection-report', period, startDate, endDate],
    queryFn: () => fetchReportData(
      period, 
      period === 'custom' ? startDate : undefined,
      period === 'custom' ? endDate : undefined
    ),
    enabled: status === 'authenticated' && isSuperAdmin,
  });

  // Redirect if not superadmin (after hooks)
  if (status === 'authenticated' && !isSuperAdmin) {
    router.push('/dashboard');
    return null;
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const periodLabels: Record<string, string> = {
    today: 'ئەمڕۆ',
    week: 'ئەم هەفتەیە',
    month: 'ئەم مانگە',
    semester: 'وەرزی تەواو',
    custom: 'دیاریکراو',
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          ڕاپۆرتی کۆکراوە
        </h1>
        <p className="text-sm text-gray-500 mt-1">پشکنینی کۆکراوەکان بەپێی پۆل</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {(['today', 'week', 'month', 'semester', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
              period === p
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <label className="text-xs text-gray-500 block mb-1">لە بەرواری</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm border rounded-lg p-2"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">بۆ بەرواری</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm border rounded-lg p-2"
            />
          </div>
        </div>
      )}

      {/* Overall Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse h-24"></div>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="mobile-card bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs">کۆی کۆکراوە</span>
              </div>
              <p className="text-2xl font-bold">{formatIQD(data.overallStats.totalCollected + data.bookCollection)}</p>
            </div>

            <div className="mobile-card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-white/80" />
                <span className="text-white/80 text-xs">کۆی خوێندکاران</span>
              </div>
              <p className="text-2xl font-bold">{data.overallStats.totalStudents}</p>
            </div>

            <div className="mobile-card border-2 border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-700 text-xs">دراوە</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{data.overallStats.paidStudents}</p>
              <p className="text-xs text-green-600 mt-1">
                {data.overallStats.totalStudents > 0 
                  ? `${Math.round((data.overallStats.paidStudents / data.overallStats.totalStudents) * 100)}%`
                  : '0%'}
              </p>
            </div>

            <div className="mobile-card border-2 border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-1">
                <X className="w-4 h-4 text-red-600" />
                <span className="text-red-700 text-xs">نەدراوە</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{data.overallStats.unpaidStudents}</p>
              <p className="text-xs text-red-600 mt-1">
                {data.overallStats.totalStudents > 0 
                  ? `${Math.round((data.overallStats.unpaidStudents / data.overallStats.totalStudents) * 100)}%`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* Forgiven and Books Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="mobile-card border-2 border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-amber-600" />
                <span className="text-amber-700 text-xs">لێخۆشبوو</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{data.overallStats.forgivenStudents}</p>
            </div>

            <div className="mobile-card border-2 border-purple-200 bg-purple-50">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-purple-700 text-xs">کتێبەکان</span>
              </div>
              <p className="text-xl font-bold text-purple-700">{formatIQD(data.bookCollection)}</p>
            </div>
          </div>

          {/* Collection by Admin */}
          {data.collectionByAdmin && data.collectionByAdmin.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                کۆکراوە بەپێی بەڕێوەبەر
              </h2>
              
              <div className="space-y-2">
                {data.collectionByAdmin.map((admin: AdminCollection) => (
                  <div 
                    key={admin.adminId} 
                    className="mobile-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                        {admin.adminName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{admin.adminName}</span>
                    </div>
                    <span className="font-bold text-green-600">{formatIQD(admin.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-Class Stats */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              بەپێی پۆل
            </h2>

            {data.classes.map((cls: ClassStats) => {
              const paidPercent = cls.totalStudents > 0 
                ? Math.round((cls.paidStudents / cls.totalStudents) * 100) 
                : 0;
              
              return (
                <div key={cls.classTime} className="mobile-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">
                      {(ku.classTimes as Record<string, string>)[cls.classTime] || cls.classTime}
                    </h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-bold",
                      paidPercent >= 80 ? "bg-green-100 text-green-700" :
                      paidPercent >= 50 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {paidPercent}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        paidPercent >= 80 ? "bg-green-500" :
                        paidPercent >= 50 ? "bg-amber-500" :
                        "bg-red-500"
                      )}
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="text-gray-500">کۆ</p>
                      <p className="font-bold text-gray-900">{cls.totalStudents}</p>
                    </div>
                    <div>
                      <p className="text-green-600">دراوە</p>
                      <p className="font-bold text-green-700">{cls.paidStudents}</p>
                    </div>
                    <div>
                      <p className="text-red-600">نەدراوە</p>
                      <p className="font-bold text-red-700">{cls.unpaidStudents}</p>
                    </div>
                    <div>
                      <p className="text-amber-600">لێخۆشبوو</p>
                      <p className="font-bold text-amber-700">{cls.forgivenStudents}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                    <span className="text-sm text-gray-500">کۆکراوە</span>
                    <span className="font-bold text-green-600">{formatIQD(cls.totalCollected)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state py-12">
          <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500">داتا نییە</p>
        </div>
      )}
    </div>
  );
}
