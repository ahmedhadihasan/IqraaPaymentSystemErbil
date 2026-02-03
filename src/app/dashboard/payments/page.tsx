'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  Filter,
  CreditCard,
  Calendar,
  User,
  Users,
  Gift,
  X,
  UserCheck,
  BookOpen,
  ChevronLeft,
  Pencil,
  Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { toEnglishNumerals } from '@/lib/text-utils';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';
import { CLASS_TIMES } from '@/lib/billing';
import { useToast } from '@/hooks/use-toast';

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentType: string;
  siblingNames: string | null;
  notes: string | null;
  studentName: string;
  recordedBy: string;
  recordedByName: string;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCount: number | null;
  createdAt: string;
}

async function fetchPayments(params: { search?: string; type?: string; period?: string; startDate?: string; endDate?: string; classTime?: string }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  if (params.period) query.set('period', params.period);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.classTime && params.classTime !== 'all') query.set('classTime', params.classTime);
  
  const res = await fetch(`/api/payments?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const data = await res.json();
  return {
    payments: data.payments || [],
    totalAmount: data.totalAmount || 0
  };
}

const paymentTypeIcons: Record<string, typeof User> = {
  single: User,
  family: Users,
  donation: Gift,
  book: BookOpen,
};

const paymentTypeColors: Record<string, string> = {
  single: 'bg-blue-100 text-blue-600',
  family: 'bg-purple-100 text-purple-600',
  donation: 'bg-amber-100 text-amber-600',
  book: 'bg-indigo-100 text-indigo-600',
};

import { useSearchParams } from 'next/navigation';

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'super_admin';
  
  const initialPeriod = searchParams.get('period') || '';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';

  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const [period, setPeriod] = useState(initialPeriod);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [showFilters, setShowFilters] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments', search, typeFilters.join(','), classFilters.join(','), period, startDate, endDate],
    queryFn: () => fetchPayments({ 
      search, 
      type: typeFilters.length > 0 ? typeFilters.join(',') : undefined, 
      classTime: classFilters.length > 0 ? classFilters.join(',') : undefined, 
      period, 
      startDate, 
      endDate 
    }),
  });

  const payments = data?.payments || [];
  const totalAmount = data?.totalAmount || 0;

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <div className="mobile-card bg-gradient-to-br from-green-500 to-green-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">{ku.payments.total}</p>
            <p className="text-2xl font-bold mt-1">{formatIQD(totalAmount)}</p>
            <p className="text-sm text-white/80 mt-1">
              {payments.length} {ku.payments.title.toLowerCase()}
            </p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Access - Monthly/Semester */}
      <div className="grid grid-cols-2 gap-3">
        <Link 
          href="/dashboard/payments/semester"
          className="mobile-card bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 hover:border-primary/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary font-bold text-lg">وەرزی</p>
              <p className="text-xs text-gray-500">Semester</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-primary group-hover:-translate-x-1 transition-transform" />
          </div>
        </Link>
        <Link 
          href="/dashboard/payments/monthly"
          className="mobile-card bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-2 border-amber-500/20 hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-600 font-bold text-lg">مانگانە</p>
              <p className="text-xs text-gray-500">Monthly</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-amber-600 group-hover:-translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

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
            showFilters || typeFilters.length > 0 || classFilters.length > 0 ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mobile-card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-gray-900">{ku.payments.type}</span>
            {(typeFilters.length > 0 || classFilters.length > 0) && (
              <button
                onClick={() => {
                  setTypeFilters([]);
                  setClassFilters([]);
                }}
                className="text-sm text-primary"
              >
                {ku.common.clear}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { key: 'single', label: ku.payments.paymentTypes.single, icon: User },
              { key: 'family', label: ku.payments.paymentTypes.family, icon: Users },
              { key: 'donation', label: ku.payments.paymentTypes.donation, icon: Gift },
              { key: 'book', label: ku.payments.paymentTypes.book, icon: BookOpen },
            ].map(({ key, label, icon: Icon }) => {
              const checked = typeFilters.includes(key);
              return (
                <label key={key} className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                  checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setTypeFilters(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key]);
                    }}
                    className="hidden"
                  />
                  <Icon className="w-4 h-4" />
                  {label}
                </label>
              );
            })}
          </div>

          {isSuperAdmin && (
            <div className="grid grid-cols-2 gap-2">
              {CLASS_TIMES.map((time) => {
                const checked = classFilters.includes(time);
                return (
                  <label key={time} className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    checked ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setClassFilters(prev => prev.includes(time) ? prev.filter(v => v !== time) : [...prev, time]);
                      }}
                      className="hidden"
                    />
                    {ku.classTimes[time] || time}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments List */}
      <div className="space-y-2">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-5 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))
        ) : payments.length === 0 ? (
          <div className="empty-state py-12">
            <CreditCard className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">{ku.payments.noPayments}</p>
          </div>
        ) : (
          payments.map((payment: Payment) => (
            <PaymentCard key={payment.id} payment={payment} onRefresh={refetch} />
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowRecordModal(true)}
        className="fab"
        aria-label={ku.payments.recordPayment}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={() => {
          setShowRecordModal(false);
          refetch();
        }}
      />
    </div>
  );
}

function PaymentCard({ payment, onRefresh }: { payment: Payment; onRefresh: () => void }) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAmount, setEditAmount] = useState(payment.amount.toString());
  
  const isSuperAdmin = session?.user?.role === 'super_admin';
  const isOwnPayment = session?.user?.id === payment.recordedBy;
  const canModify = isSuperAdmin || isOwnPayment;
  
  const Icon = paymentTypeIcons[payment.paymentType] || CreditCard;
  const colorClass = paymentTypeColors[payment.paymentType] || 'bg-gray-100 text-gray-600';

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      toast({ title: 'پارەدان سڕایەوە' });
      onRefresh();
    },
    onError: (error: any) => {
      toast({ 
        title: 'هەڵە', 
        description: error.message || 'نەتوانرا پارەدان بسڕێتەوە',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (newAmount: number) => {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      toast({ title: 'پارەدان نوێکرایەوە' });
      setShowEditModal(false);
      onRefresh();
    },
    onError: (error: any) => {
      toast({ 
        title: 'هەڵە', 
        description: error.message || 'نەتوانرا پارەدان نوێبکرێتەوە',
        variant: 'destructive'
      });
    }
  });

  const handleDelete = () => {
    if (confirm('دڵنیایت لە سڕینەوەی ئەم پارەدانە؟')) {
      deleteMutation.mutate();
    }
    setShowActions(false);
  };

  const handleEdit = () => {
    setEditAmount(payment.amount.toString());
    setShowEditModal(true);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    const newAmount = Number(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      toast({ 
        title: 'هەڵە', 
        description: 'بڕی دروست بنووسە',
        variant: 'destructive'
      });
      return;
    }
    updateMutation.mutate(newAmount);
  };

  // Format period display
  const formatPeriod = () => {
    if (!payment.periodStart || !payment.periodEnd) return null;
    const start = new Date(payment.periodStart);
    const end = new Date(payment.periodEnd);
    return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  };

  return (
    <>
      <div 
        className="mobile-card cursor-pointer relative"
        onClick={() => canModify && setShowActions(!showActions)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{payment.studentName}</h3>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(payment.paymentDate).toLocaleDateString('en-GB')}</span>
            </div>
            {payment.siblingNames && (
              <p className="text-xs text-purple-600 mt-1 truncate">
                + {payment.siblingNames}
              </p>
            )}
            {payment.recordedByName && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <UserCheck className="w-3 h-3" />
                <span>{payment.recordedByName}</span>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="text-left">
            {payment.amount === 0 ? (
              <p className="font-bold text-amber-600">بەخۆڕایی</p>
            ) : (
              <p className="font-bold text-green-600">{formatIQD(payment.amount)}</p>
            )}
            {formatPeriod() && (
              <p className="text-xs text-gray-500 whitespace-nowrap" dir="ltr">{formatPeriod()}</p>
            )}
            {payment.monthsCount && (
              <p className="text-xs text-gray-400">{payment.monthsCount} {ku.payments.months}</p>
            )}
          </div>
        </div>

        {/* Action Buttons - shown when clicked */}
        {canModify && showActions && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex gap-2 animate-fade-in">
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(); }}
              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Edit Amount Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">گۆڕینی بڕی پارە</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">بڕی نوێ (دینار)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={editAmount}
                onChange={(e) => setEditAmount(toEnglishNumerals(e.target.value))}
                className="mobile-input text-center text-lg font-bold"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium"
              >
                هەڵوەشاندنەوە
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-medium disabled:opacity-50"
              >
                {updateMutation.isPending ? 'چاوەڕێ بکە...' : 'پاشەکەوتکردن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
