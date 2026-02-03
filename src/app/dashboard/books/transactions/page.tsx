'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, BookOpen, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { CLASS_TIMES } from '@/lib/billing';

interface Book {
  id: string;
  title: string;
}

interface BookSale {
  id: string;
  book: {
    id: string;
    title: string;
  };
  payment: {
    amount: number;
    paymentDate: string;
    student: {
      id: string;
      name: string;
      gender: string;
      classTime?: string | null;
    };
  };
}

export default function BookTransactionsPage() {
  const searchParams = useSearchParams();
  const initialBookId = searchParams.get('bookId') || '';

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [genderFilters, setGenderFilters] = useState<string[]>([]);
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const [bookFilters, setBookFilters] = useState<string[]>([]);

  useEffect(() => {
    if (initialBookId) {
      setBookFilters([initialBookId]);
    }
  }, [initialBookId]);

  const { data: books = [] } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const res = await fetch('/api/books');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: [
      'book-sales',
      period,
      startDate,
      endDate,
      genderFilters.join(','),
      classFilters.join(','),
      bookFilters.join(','),
    ],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set('type', 'sales');
      if (period) query.set('period', period);
      if (period === 'custom' && startDate && endDate) {
        query.set('startDate', startDate);
        query.set('endDate', endDate);
      }
      if (genderFilters.length > 0) query.set('gender', genderFilters.join(','));
      if (classFilters.length > 0) query.set('classTime', classFilters.join(','));
      if (bookFilters.length > 0) query.set('bookId', bookFilters.join(','));
      const res = await fetch(`/api/books?${query.toString()}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const totalAmount = useMemo(() => {
    return sales.reduce((sum: number, s: BookSale) => sum + (s.payment?.amount || 0), 0);
  }, [sales]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/books">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100">
              <ArrowRight className="w-5 h-5" />
            </div>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">فرۆشتنەکانی کتێب</h1>
            <p className="text-xs text-gray-500">{sales.length} فرۆشتن</p>
          </div>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold ring-1 ring-primary/20">
          {formatIQD(totalAmount)}
        </div>
      </div>

      <div className="mobile-card">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-gray-900">فلتەرەکان</span>
          <button
            onClick={() => {
              setPeriod('all');
              setStartDate('');
              setEndDate('');
              setGenderFilters([]);
              setClassFilters([]);
              setBookFilters([]);
            }}
            className="text-sm text-primary"
          >
            {ku.common.clear}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { key: 'today', label: ku.payments.today },
            { key: 'week', label: ku.payments.thisWeek },
            { key: 'month', label: ku.payments.thisMonth },
            { key: 'all', label: ku.dashboard.allTime },
            { key: 'custom', label: 'بەرواری دیاری کراو' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key as any)}
              className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-colors ${
                period === key ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { key: 'male', label: ku.students.male },
            { key: 'female', label: ku.students.female },
          ].map(({ key, label }) => {
            const checked = genderFilters.includes(key);
            return (
              <label key={key} className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setGenderFilters(prev => prev.includes(key) ? prev.filter(v => v !== key) : [...prev, key]);
                  }}
                  className="hidden"
                />
                {label}
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
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

        <div className="grid grid-cols-2 gap-2">
          {books.map((book: Book) => {
            const checked = bookFilters.includes(book.id);
            return (
              <label key={book.id} className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setBookFilters(prev => prev.includes(book.id) ? prev.filter(v => v !== book.id) : [...prev, book.id]);
                  }}
                  className="hidden"
                />
                {book.title}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="mobile-card animate-pulse h-20"></div>)
        ) : sales.length === 0 ? (
          <div className="empty-state py-10">
            <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500">هیچ فرۆشتنێک نییە</p>
          </div>
        ) : (
          sales.map((sale: BookSale) => (
            <div key={sale.id} className="mobile-card">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{sale.book?.title || 'کتێب'}</p>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(sale.payment?.paymentDate || Date.now()).toLocaleDateString('en-GB')}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{sale.payment?.student?.name}</p>
                  {sale.payment?.student?.classTime && (
                    <p className="text-xs text-gray-400 mt-0.5">{ku.classTimes[sale.payment.student.classTime as keyof typeof ku.classTimes] || sale.payment.student.classTime}</p>
                  )}
                </div>
                <div className="text-left">
                  {(sale.payment?.amount || 0) === 0 ? (
                    <p className="font-bold text-amber-600">بەخۆڕایی</p>
                  ) : (
                    <p className="font-bold text-green-600">{formatIQD(sale.payment?.amount || 0)}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
