'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Search, 
  Calendar,
  User,
  Check,
  X,
  ChevronRight,
  ArrowRight,
  Filter,
  CreditCard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { cn } from '@/lib/utils';
import { PRICING } from '@/lib/billing';

// Month definitions for 2026 semester
const MONTHS = [
  { key: '2026-01', label: 'کانوونی دووەم', labelEn: 'January', num: 1 },
  { key: '2026-02', label: 'شوبات', labelEn: 'February', num: 2 },
  { key: '2026-03', label: 'ئازار', labelEn: 'March', num: 3 },
  { key: '2026-04', label: 'نیسان', labelEn: 'April', num: 4 },
  { key: '2026-05', label: 'ئایار', labelEn: 'May', num: 5 },
  { key: '2026-06', label: 'حوزەیران', labelEn: 'June', num: 6 },
];

interface Student {
  id: string;
  name: string;
  gender: string;
  classTime: string | null;
  billingPreference: string;
  hasPaid?: boolean;
  isForgiven?: boolean;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  monthsCount: number;
  billingMode?: string;
}

async function fetchStudents(isSuperAdmin: boolean) {
  // For admins, only fetch their assigned class students
  // For superadmin, fetch all monthly billing preference students
  const url = isSuperAdmin 
    ? '/api/students?status=active' 
    : '/api/students?myStudents=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
}

async function fetchPaymentsForStudents(studentIds: string[]) {
  // Fetch ALL payments for these students (regardless of who recorded them)
  // This ensures we see payments made by superadmin too
  if (studentIds.length === 0) return [];
  const res = await fetch(`/api/payments?studentIds=${studentIds.join(',')}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const data = await res.json();
  return data.payments || [];
}

export default function MonthlyPaymentsPage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [search, setSearch] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);

  const isSuperAdmin = session?.user?.role === 'super_admin';

  const { data: allStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['monthly-students', isSuperAdmin],
    queryFn: () => fetchStudents(isSuperAdmin),
    enabled: status === 'authenticated',
  });

  // Filter to monthly students first
  const monthlyStudents = useMemo(() =>
    allStudents.filter((student: Student) => (student.billingPreference || 'semester') === 'monthly'),
  [allStudents]);

  // Get student IDs for fetching their payments - only fetch for monthly students
  const studentIds = useMemo(() => monthlyStudents.map((s: Student) => s.id), [monthlyStudents]);
  const studentIdsKey = studentIds.join(',');

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['student-payments', studentIdsKey],
    queryFn: () => fetchPaymentsForStudents(studentIds),
    enabled: studentIds.length > 0,
    staleTime: 0, // Always refetch when invalidated
  });

  // Calculate paid status for each student per month (checks ALL payments - monthly and semester)
  // Forgiven students are automatically considered "paid" for all months
  const studentMonthStatus = useMemo(() => {
    const status: Record<string, Record<string, boolean>> = {};

    // Check monthly students payment status
    monthlyStudents.forEach((student: Student) => {
      status[student.id] = {};
      MONTHS.forEach(month => {
        // Forgiven students are always considered "paid"
        if (student.isForgiven) {
          status[student.id][month.key] = true;
          return;
        }
        
        const monthStart = new Date(`${month.key}-01`);
        // Get the last day of the month for proper range check
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        
        const hasPaidForMonth = payments.some((payment: Payment) => {
          if (payment.studentId !== student.id) return false;
          const periodStart = new Date(payment.periodStart);
          const periodEnd = new Date(payment.periodEnd);
          
          // A month is paid if it falls within ANY payment period (monthly or semester)
          // The month is covered if monthStart >= periodStart AND monthStart < periodEnd
          return monthStart >= periodStart && monthStart < periodEnd;
        });
        status[student.id][month.key] = hasPaidForMonth;
      });
    });

    return status;
  }, [monthlyStudents, payments]);

  // Calculate month stats using monthly students only
  const monthStats = useMemo(() => {
    const stats: Record<string, { paid: number; unpaid: number; total: number }> = {};

    MONTHS.forEach(month => {
      let paid = 0;
      let unpaid = 0;

      monthlyStudents.forEach((student: Student) => {
        if (studentMonthStatus[student.id]?.[month.key]) {
          paid++;
        } else {
          unpaid++;
        }
      });

      stats[month.key] = { paid, unpaid, total: paid + unpaid };
    });

    return stats;
  }, [monthlyStudents, studentMonthStatus]);

  // Filter students for selected month
  const filteredStudents = useMemo(() => {
    if (!selectedMonth) return [];

    const searchTerm = search.trim().toLowerCase();
    const baseList = searchTerm ? allStudents : monthlyStudents;

    return baseList.filter((student: Student) => {
      if (searchTerm && !student.name.toLowerCase().includes(searchTerm)) {
        return false;
      }

      const isMonthly = (student.billingPreference || 'semester') === 'monthly';
      const isPaid = isMonthly && (studentMonthStatus[student.id]?.[selectedMonth] || false);

      if (paidFilter === 'paid' && !isPaid) return false;
      if (paidFilter === 'unpaid' && isPaid) return false;

      return true;
    });
  }, [allStudents, monthlyStudents, selectedMonth, search, paidFilter, studentMonthStatus]);

  const handlePayment = (student: Student) => {
    setPaymentStudent(student);
    setShowPaymentModal(true);
  };

  const isLoading = loadingStudents || loadingPayments;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">پارەدانی مانگانە</h1>
          <p className="text-sm text-gray-500">{monthlyStudents.length} قوتابی</p>
        </div>
        <Link 
          href="/dashboard/payments/semester"
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          وەرزی
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Total Stats Card */}
      <div className="mobile-card bg-gradient-to-br from-amber-500 to-amber-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">کۆی قوتابیانی مانگانە</p>
            <p className="text-3xl font-bold mt-1">{monthlyStudents.length}</p>
            <p className="text-sm text-white/80 mt-1">
              نرخی مانگانە: {formatIQD(PRICING.MONTHLY)}
            </p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Calendar className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Month Selection - Compact Horizontal Scroll */}
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="flex gap-2 min-w-max">
          {MONTHS.map((month) => {
            const stats = monthStats[month.key] || { paid: 0, unpaid: 0, total: 0 };
            const isSelected = selectedMonth === month.key;
            const paidPercent = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;
            
            return (
              <button
                key={month.key}
                onClick={() => setSelectedMonth(isSelected ? null : month.key)}
                className={cn(
                  "relative flex-shrink-0 w-24 p-3 rounded-xl border-2 transition-all text-center overflow-hidden",
                  isSelected 
                    ? "border-primary bg-primary/10 shadow-md" 
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${paidPercent}%` }}
                  />
                </div>
                
                <p className={cn(
                  "font-bold text-sm",
                  isSelected ? "text-primary" : "text-gray-900"
                )}>
                  {month.label}
                </p>
                
                {/* Percentage display */}
                <p className={cn(
                  "text-xs font-bold mt-0.5",
                  paidPercent >= 80 ? "text-green-600" : paidPercent >= 50 ? "text-amber-600" : "text-red-500"
                )}>
                  {paidPercent}%
                </p>
                
                <div className="flex items-center justify-center gap-2 mt-1 text-xs">
                  <span className="text-green-600 font-bold">{stats.paid}</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-red-500 font-bold">{stats.unpaid}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Month Details */}
      {selectedMonth && (
        <div className="space-y-4 animate-fade-in">
          {/* Month Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              {MONTHS.find(m => m.key === selectedMonth)?.label}
            </h2>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              داخستن
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="search"
              placeholder="گەڕان..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mobile-input pr-10"
            />
          </div>

          {/* Paid/Unpaid Filter Tabs */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setPaidFilter('all')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                paidFilter === 'all' 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500"
              )}
            >
              هەموو ({monthStats[selectedMonth]?.total || 0})
            </button>
            <button
              onClick={() => setPaidFilter('paid')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                paidFilter === 'paid' 
                  ? "bg-green-500 text-white shadow-sm" 
                  : "text-gray-500"
              )}
            >
              دراوە ({monthStats[selectedMonth]?.paid || 0})
            </button>
            <button
              onClick={() => setPaidFilter('unpaid')}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                paidFilter === 'unpaid' 
                  ? "bg-red-500 text-white shadow-sm" 
                  : "text-gray-500"
              )}
            >
              نەدراوە ({monthStats[selectedMonth]?.unpaid || 0})
            </button>
          </div>

          {/* Students List */}
          <div className="space-y-2">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="mobile-card animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>هیچ قوتابییەک نییە</p>
              </div>
            ) : (
              filteredStudents.map((student: Student) => {
                const isMonthlyStudent = (student.billingPreference || 'semester') === 'monthly';
                const isPaid = isMonthlyStudent && (studentMonthStatus[student.id]?.[selectedMonth] || false);
                const isForgiven = student.isForgiven;

                return (
                  <div 
                    key={student.id}
                    className={cn(
                      "mobile-card flex items-center gap-3",
                      isForgiven ? "bg-amber-50 border border-amber-200" :
                      isPaid ? "bg-green-50 border border-green-200" : "",
                      !isMonthlyStudent ? "border-amber-200 bg-amber-50/60" : ""
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      student.gender === 'male' 
                        ? "bg-blue-100 text-blue-600" 
                        : "bg-pink-100 text-pink-600"
                    )}>
                      <User className="w-6 h-6" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500">
                        {student.classTime ? ku.classTimes[student.classTime as keyof typeof ku.classTimes] : 'کات دیاری نەکراوە'}
                      </p>
                      <p
                        className={cn(
                          "text-xs mt-1 font-medium",
                          isForgiven ? "text-amber-600" :
                          isMonthlyStudent ? "text-green-600" : "text-amber-600"
                        )}
                      >
                        {isForgiven ? 'لێخۆشبوو' : isMonthlyStudent ? 'پارەدان بە مانگ' : 'پارەدان بە وەرز'}
                      </p>
                    </div>
                    
                    {/* Status / Action */}
                    {isForgiven ? (
                      <div className="flex items-center gap-1 text-amber-600 font-medium text-sm">
                        <Check className="w-5 h-5" />
                        لێخۆشبوو
                      </div>
                    ) : isPaid ? (
                      <div className="flex items-center gap-1 text-green-600 font-medium text-sm">
                        <Check className="w-5 h-5" />
                        دراوە
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePayment(student)}
                        className={cn(
                          "flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                          isMonthlyStudent 
                            ? "bg-primary text-white hover:bg-primary/90"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        )}
                      >
                        <CreditCard className="w-4 h-4" />
                        {isMonthlyStudent ? 'پارەدان' : 'گۆڕین بۆ مانگانە'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* No Month Selected State */}
      {!selectedMonth && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">مانگێک هەڵبژێرە</p>
          <p className="text-sm mt-1">بۆ بینینی لیستی قوتابیان و بارەکانیان</p>
        </div>
      )}

      {/* Payment Modal */}
      <RecordPaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentStudent(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['student-payments'] });
          queryClient.invalidateQueries({ queryKey: ['monthly-students'] });
        }}
        preselectedStudent={paymentStudent ? {
          ...paymentStudent,
          classTime: paymentStudent.classTime || undefined
        } : null}
        defaultBillingType="monthly"
        lockedMonth={selectedMonth || undefined}
      />
    </div>
  );
}
