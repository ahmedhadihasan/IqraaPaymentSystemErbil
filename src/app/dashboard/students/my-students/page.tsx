'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  Upload, 
  Filter,
  User,
  Phone,
  MapPin,
  ChevronDown,
  Trash2,
  Edit,
  CreditCard,
  Check,
  AlertCircle,
  UsersRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { SEMESTER } from '@/lib/billing';
import { useToast } from '@/hooks/use-toast';
import { AddStudentModal } from '@/components/students/add-student-modal';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';

interface Student {
  id: string;
  name: string;
  gender: string;
  birthYear: string | null;
  address: string | null;
  phone: string | null;
  financialStatus: string | null;
  status: string;
  classTime: string | null;
  hasPaid?: boolean;
  isForgiven: boolean;
}

async function fetchMyStudents(params: { search?: string; gender?: string }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.gender) query.set('gender', params.gender);
  query.set('myStudents', 'true');
  
  const res = await fetch(`/api/students?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
}

async function fetchSemesterPayments() {
  const query = new URLSearchParams();
  query.set('period', 'custom');
  query.set('startDate', SEMESTER.START.toISOString());
  query.set('endDate', SEMESTER.END.toISOString());
  query.set('type', 'single,family');

  const res = await fetch(`/api/payments?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const data = await res.json();
  return data.totalAmount || 0;
}

async function fetchAdminInfo(adminId: string) {
  const res = await fetch(`/api/admins/${adminId}`);
  if (!res.ok) return null;
  return res.json();
}

export default function MyStudentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ['my-students', search, genderFilter],
    queryFn: () => fetchMyStudents({ search, gender: genderFilter }),
  });

  const { data: semesterAmount = 0 } = useQuery({
    queryKey: ['semester-payments', 'my-students', session?.user?.role],
    queryFn: fetchSemesterPayments,
  });

  // Fetch admin info for default values when adding student
  const { data: adminInfo } = useQuery({
    queryKey: ['admin-info', session?.user?.id],
    queryFn: () => fetchAdminInfo(session?.user?.id || ''),
    enabled: !!session?.user?.id && session?.user?.role !== 'super_admin',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      toast({ title: ku.students.studentDeleted });
    },
    onError: () => {
      toast({ title: ku.errors.generic, variant: 'destructive' });
    },
  });

  const toggleForgivenMutation = useMutation({
    mutationFn: async ({ id, isForgiven }: { id: string; isForgiven: boolean }) => {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isForgiven }),
      });
      if (!res.ok) throw new Error('Failed to update student');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-students'] });
      toast({ title: 'باری خوێندکار نوێکرایەوە' });
    },
    onError: () => {
      toast({ title: ku.errors.generic, variant: 'destructive' });
    },
  });

  const handleDelete = (student: Student) => {
    if (confirm(ku.students.confirmDelete)) {
      deleteMutation.mutate(student.id);
    }
  };

  const handlePayment = (student: Student) => {
    if (student.hasPaid) {
      toast({ title: 'ئەم قوتابییە پارەی داوە بۆ ئەم وەرزە', variant: 'destructive' });
      return;
    }
    setPaymentStudent(student);
    setShowPaymentModal(true);
  };

  const handleToggleForgiven = (student: Student) => {
    toggleForgivenMutation.mutate({ 
      id: student.id, 
      isForgiven: !student.isForgiven 
    });
  };

  // Filter students by paid status
  const filteredStudents = (students as Student[]).filter((student: Student) => {
    if (paidFilter === 'paid') return student.hasPaid;
    if (paidFilter === 'unpaid') return !student.hasPaid;
    return true;
  });

  const paidCount = filteredStudents.filter((student: Student) => student.hasPaid).length;
  const unpaidCount = filteredStudents.length - paidCount;
  const forgivenCount = filteredStudents.filter((student: Student) => student.isForgiven).length;

  // Check if admin has assigned class times
  const hasNoAssignedClasses = session?.user?.role !== 'super_admin' && students.length === 0 && !search && !genderFilter;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">{ku.students.myStudents}</h1>
        <Link 
          href="/dashboard/students"
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          <UsersRound className="w-4 h-4" />
          {ku.students.allStudents}
        </Link>
      </div>

      {/* Warning if no assigned classes */}
      {hasNoAssignedClasses && (
        <div className="mobile-card bg-amber-50 border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">هیچ پۆلێک دیاری نەکراوە</p>
            <p className="text-sm text-amber-700 mt-1">
              پەیوەندی بە سەرپەرشتیار بکە بۆ دیاریکردنی پۆلەکانت
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="search"
            placeholder={ku.students.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mobile-input pr-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 transition-colors ${
            showFilters || genderFilter ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mobile-card animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">{ku.common.filter}</span>
            {(genderFilter || paidFilter !== 'all') && (
              <button
                onClick={() => { setGenderFilter(''); setPaidFilter('all'); }}
                className="text-sm text-primary"
              >
                {ku.common.clear}
              </button>
            )}
          </div>
          
          {/* Gender Filter */}
          <p className="text-sm text-gray-500 mb-2">ڕەگەز</p>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setGenderFilter('')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                !genderFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ku.students.all}
            </button>
            <button
              onClick={() => setGenderFilter('male')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                genderFilter === 'male' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ku.students.male}
            </button>
            <button
              onClick={() => setGenderFilter('female')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                genderFilter === 'female' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ku.students.female}
            </button>
          </div>

          {/* Paid Status Filter */}
          <p className="text-sm text-gray-500 mb-2">بارى پارەدان</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPaidFilter('all')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                paidFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              هەموو
            </button>
            <button
              onClick={() => setPaidFilter('paid')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                paidFilter === 'paid' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              دراوە
            </button>
            <button
              onClick={() => setPaidFilter('unpaid')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                paidFilter === 'unpaid' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              نەدراوە
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="mobile-card">
          <p className="text-xs text-gray-500">دراوە</p>
          <p className="text-lg font-bold text-green-600">{paidCount}</p>
        </div>
        <div className="mobile-card">
          <p className="text-xs text-gray-500">نەدراوە</p>
          <p className="text-lg font-bold text-red-600">{unpaidCount}</p>
        </div>
        <div className="mobile-card">
          <p className="text-xs text-gray-500">کۆی پارەی وەرز</p>
          <p className="text-lg font-bold text-primary">{formatIQD(semesterAmount)}</p>
        </div>
        {session?.user?.role === 'super_admin' && (
          <div className="mobile-card">
            <p className="text-xs text-gray-500">لێخۆشبوو</p>
            <p className="text-lg font-bold text-amber-600">{forgivenCount}</p>
          </div>
        )}
        <div className="flex items-center justify-between px-1 col-span-2">
          <span className="text-sm text-gray-500">
            {ku.students.total}: <strong>{filteredStudents.length}</strong>
            {paidFilter !== 'all' && (
              <span className="mr-2">
                ({paidFilter === 'paid' ? 'دراوە' : 'نەدراوە'})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeleton
          [...Array(5)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state py-12">
            <User className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-4">
              {hasNoAssignedClasses ? 'هیچ پۆلێک دیاری نەکراوە' : ku.students.noStudents}
            </p>
          </div>
        ) : (
          filteredStudents.map((student: Student) => (
            <StudentCard 
              key={student.id} 
              student={student}
              onEdit={() => setSelectedStudent(student)}
              onDelete={() => handleDelete(student)}
              onPayment={() => handlePayment(student)}
              onToggleForgiven={() => handleToggleForgiven(student)}
              isUpdating={toggleForgivenMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        aria-label={ku.students.addStudent}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <AddStudentModal
        open={showAddModal || !!selectedStudent}
        onClose={() => {
          setShowAddModal(false);
          setSelectedStudent(null);
        }}
        student={selectedStudent}
        onSuccess={() => {
          setShowAddModal(false);
          setSelectedStudent(null);
          refetch();
        }}
        defaultGender={adminInfo?.assignedGender}
        defaultClassTime={adminInfo?.assignedClassTimes?.split(',')[0]}
      />

      <RecordPaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentStudent(null);
        }}
        onSuccess={() => {
          setShowPaymentModal(false);
          setPaymentStudent(null);
          refetch();
        }}
        preselectedStudent={paymentStudent ? {
          ...paymentStudent,
          classTime: paymentStudent.classTime || undefined
        } : null}
      />
    </div>
  );
}

function StudentCard({ 
  student, 
  onEdit, 
  onDelete,
  onPayment,
  onToggleForgiven,
  isUpdating
}: { 
  student: Student;
  onEdit: () => void;
  onDelete: () => void;
  onPayment: () => void;
  onToggleForgiven: () => void;
  isUpdating?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`mobile-card ${student.hasPaid ? 'border-l-4 border-l-green-500' : ''}`}>
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          student.hasPaid 
            ? 'bg-green-100' 
            : student.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
        }`}>
          {student.hasPaid ? (
            <Check className="w-6 h-6 text-green-600" />
          ) : (
            <User className={`w-6 h-6 ${
              student.gender === 'male' ? 'text-blue-600' : 'text-pink-600'
            }`} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{student.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`status-badge ${
              student.gender === 'male' ? 'gender-male' : 'gender-female'
            }`}>
              {student.gender === 'male' ? ku.students.male : ku.students.female}
            </span>
            {student.hasPaid && (
              <span className="text-xs text-green-600 font-medium">دراوە ✓</span>
            )}
            {student.isForgiven && (
              <span className="text-xs text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">لێخۆشبوو</span>
            )}
            {student.birthYear && (
              <span className="text-xs text-gray-500">{student.birthYear}</span>
            )}
          </div>
        </div>

        {/* Quick Payment Button */}
        {!student.hasPaid && (
          <button
            onClick={(e) => { e.stopPropagation(); onPayment(); }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-100 text-green-600 hover:bg-green-200"
          >
            <CreditCard className="w-5 h-5" />
          </button>
        )}

        {/* Expand Icon */}
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
          expanded ? 'rotate-180' : ''
        }`} />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-fade-in">
          {student.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700" dir="ltr">{student.phone}</span>
            </div>
          )}
          {student.address && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{student.address}</span>
            </div>
          )}
          {student.financialStatus && (
            <div className="text-sm">
              <span className="text-gray-500">{ku.students.financialStatus}: </span>
              <span className="text-gray-700">{student.financialStatus}</span>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {!student.hasPaid && (
              <button
                onClick={(e) => { e.stopPropagation(); onPayment(); }}
                className="py-2 px-4 rounded-lg bg-green-100 text-green-700 font-medium text-sm flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                پارەدان
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="py-2 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {ku.common.edit}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleForgiven(); }}
              disabled={isUpdating}
              className={`py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                student.isForgiven 
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Check className="w-4 h-4" />
              {student.isForgiven ? 'لادانی لێخۆشبوون' : 'لێخۆشبوون'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="py-2 px-4 rounded-lg bg-red-100 text-red-600 font-medium text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
