'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Search, 
  Calendar,
  User,
  Check,
  ChevronRight,
  CreditCard,
  Users
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { cn } from '@/lib/utils';
import { PRICING, SEMESTER } from '@/lib/billing';

interface Student {
  id: string;
  name: string;
  gender: string;
  classTime: string | null;
  billingPreference: string;
  hasPaid?: boolean;
  isForgiven?: boolean;
}

async function fetchAllStudents(isSuperAdmin: boolean) {
  // For admins, only fetch their assigned class students
  const url = isSuperAdmin ? '/api/students' : '/api/students?myStudents=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
}

export default function SemesterPaymentsPage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const isSuperAdmin = session?.user?.role === 'super_admin';
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [search, setSearch] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);

  const { data: allStudents = [], isLoading } = useQuery({
    queryKey: ['semester-students', isSuperAdmin],
    queryFn: () => fetchAllStudents(isSuperAdmin),
    enabled: status === 'authenticated',
  });

  // Semester students only
  const students = useMemo(() => 
    allStudents.filter((s: Student) => (s.billingPreference || 'semester') === 'semester'),
  [allStudents]);

  // Calculate stats - forgiven students count as "paid"
  const stats = useMemo(() => {
    const paid = students.filter((s: Student) => s.hasPaid || s.isForgiven).length;
    const unpaid = students.filter((s: Student) => !s.hasPaid && !s.isForgiven).length;
    return { paid, unpaid, total: students.length };
  }, [students]);

  // Filter students - when searching, include all students (not just semester)
  // Forgiven students count as "paid"
  const filteredStudents = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const baseList = searchTerm ? allStudents : students;
    
    let result = baseList.filter((student: Student) => {
      // Search filter
      if (searchTerm && !student.name.toLowerCase().includes(searchTerm)) {
        return false;
      }
      
      const isSemester = (student.billingPreference || 'semester') === 'semester';
      const isPaid = isSemester && (student.hasPaid || student.isForgiven);
      
      // Paid filter (only for semester students)
      if (paidFilter === 'paid' && !isPaid) return false;
      if (paidFilter === 'unpaid' && isPaid) return false;
      
      return true;
    });
    
    return result;
  }, [allStudents, students, search, paidFilter]);

  const handlePayment = (student: Student) => {
    if (student.hasPaid) return;
    setPaymentStudent(student);
    setShowPaymentModal(true);
  };

  const paidPercent = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">پارەدانی وەرزی</h1>
          <p className="text-sm text-gray-500">{students.length} قوتابی</p>
        </div>
        <Link 
          href="/dashboard/payments/monthly"
          className="flex items-center gap-1 text-sm text-amber-600 font-medium"
        >
          مانگانە
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Card */}
      <div className="mobile-card bg-gradient-to-br from-primary to-[#2d5a87] text-white relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/20">
          <div 
            className="h-full bg-green-400 transition-all duration-500"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">کۆی قوتابیانی وەرزی</p>
            <p className="text-3xl font-bold mt-1">{students.length}</p>
            <p className="text-sm text-white/80 mt-1">
              نرخی وەرز: {formatIQD(PRICING.SINGLE_STUDENT)}
            </p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
        </div>
        
        <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-white/60 text-xs">دراوە</p>
            <p className="text-xl font-bold text-green-300">{stats.paid}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">نەدراوە</p>
            <p className="text-xl font-bold text-red-300">{stats.unpaid}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">ڕێژەی دراوە</p>
            <p className="text-xl font-bold">{paidPercent}%</p>
          </div>
        </div>
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
          هەموو ({stats.total})
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
          دراوە ({stats.paid})
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
          نەدراوە ({stats.unpaid})
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
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>هیچ قوتابییەک نییە</p>
          </div>
        ) : (
          filteredStudents.map((student: Student) => {
            const isSemesterStudent = (student.billingPreference || 'semester') === 'semester';
            const isPaid = isSemesterStudent && student.hasPaid;
            const isForgiven = student.isForgiven;
            
            return (
              <div 
                key={student.id}
                className={cn(
                  "mobile-card flex items-center gap-3",
                  isForgiven ? "bg-amber-50 border border-amber-200" :
                  isPaid ? "bg-green-50 border border-green-200" : "",
                  !isSemesterStudent ? "border-amber-200 bg-amber-50/60" : ""
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
                      isSemesterStudent ? "text-green-600" : "text-amber-600"
                    )}
                  >
                    {isForgiven ? 'لێخۆشبوو' : isSemesterStudent ? 'پارەدان بە وەرز' : 'پارەدان بە مانگ'}
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
                      isSemesterStudent 
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    {isSemesterStudent ? 'پارەدان' : 'گۆڕین بۆ وەرزی'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      <RecordPaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentStudent(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['semester-students'] });
        }}
        preselectedStudent={paymentStudent ? {
          ...paymentStudent,
          classTime: paymentStudent.classTime || undefined
        } : null}
        defaultBillingType="semester"
      />
    </div>
  );
}
