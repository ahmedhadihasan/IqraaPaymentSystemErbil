'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Plus, 
  Filter,
  CreditCard,
  Calendar,
  User,
  Users,
  Gift,
  GraduationCap,
  X,
  UserCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { RecordPaymentModal } from '@/components/payments/record-payment-modal';

interface Payment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentType: string;
  siblingNames: string | null;
  notes: string | null;
  studentName: string;
  recordedByName: string;
  periodStart: string | null;
  periodEnd: string | null;
  monthsCount: number | null;
  createdAt: string;
}

async function fetchPayments(params: { search?: string; type?: string }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  
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
  sibling_group: Users,
  donation: Gift,
  scholarship: GraduationCap,
};

const paymentTypeColors: Record<string, string> = {
  single: 'bg-blue-100 text-blue-600',
  sibling_group: 'bg-purple-100 text-purple-600',
  donation: 'bg-amber-100 text-amber-600',
  scholarship: 'bg-green-100 text-green-600',
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments', search, typeFilter],
    queryFn: () => fetchPayments({ search, type: typeFilter }),
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
            showFilters || typeFilter ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mobile-card animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">{ku.payments.type}</span>
            {typeFilter && (
              <button
                onClick={() => setTypeFilter('')}
                className="text-sm text-primary"
              >
                {ku.common.clear}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ku.payments.paymentTypes).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  typeFilter === key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {(() => {
                  const Icon = paymentTypeIcons[key] || CreditCard;
                  return <Icon className="w-4 h-4" />;
                })()}
                {label}
              </button>
            ))}
          </div>
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
            <PaymentCard key={payment.id} payment={payment} />
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

function PaymentCard({ payment }: { payment: Payment }) {
  const Icon = paymentTypeIcons[payment.paymentType] || CreditCard;
  const colorClass = paymentTypeColors[payment.paymentType] || 'bg-gray-100 text-gray-600';

  // Format period display
  const formatPeriod = () => {
    if (!payment.periodStart || !payment.periodEnd) return null;
    const start = new Date(payment.periodStart);
    const end = new Date(payment.periodEnd);
    return `${start.getDate()}/${start.getMonth() + 1}/${start.getFullYear()} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  };

  return (
    <div className="mobile-card">
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
            <span>{new Date(payment.paymentDate).toLocaleDateString('ku-IQ')}</span>
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
          <p className="font-bold text-green-600">{formatIQD(payment.amount)}</p>
          {formatPeriod() && (
            <p className="text-xs text-gray-500 whitespace-nowrap" dir="ltr">{formatPeriod()}</p>
          )}
          {payment.monthsCount && (
            <p className="text-xs text-gray-400">{payment.monthsCount} {ku.payments.months}</p>
          )}
        </div>
      </div>
    </div>
  );
}
