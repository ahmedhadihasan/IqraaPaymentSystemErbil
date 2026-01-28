'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {  
  Search,
  BookOpen, 
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  User,
  CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';

interface Book {
  id: string;
  title: string;
  price: number;
}

interface Student {
  id: string;
  name: string;
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
    } | null;
  };
}

export default function BookSalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [saleType, setSaleType] = useState<'exact' | 'free' | 'custom'>('exact');

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const res = await fetch('/api/books');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: students = [], isLoading: isSearching } = useQuery({
    queryKey: ['students-brief', studentSearch],
    queryFn: async () => {
      if (!studentSearch || studentSearch.length < 1) return [];
      const res = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: studentSearch.length > 0,
  });

  const recordSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'sale' }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['book-sales'] });
      setSelectedBook(null);
      setSelectedStudentId(null);
      setStudentSearch('');
      setCustomAmount('');
      setSaleType('exact');
      toast({ title: 'فرۆشتنی کتێب تۆمارکرا' });
    },
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['book-sales'],
    queryFn: async () => {
      const res = await fetch('/api/books?type=sales');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const handleSale = () => {
    if (!selectedBook) return;
    
    let amount = selectedBook.price;
    if (saleType === 'free') amount = 0;
    if (saleType === 'custom') amount = Number(customAmount);

    recordSaleMutation.mutate({
      bookId: selectedBook.id,
      amount,
      studentId: selectedStudentId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">فرۆشتنی کتێب</h1>
        <Link href="/dashboard/books/transactions" className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold ring-1 ring-primary/20">
          هەموو فرۆشتنەکان
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {booksLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="mobile-card animate-pulse h-24"></div>)
        ) : (
          books.map((book: Book) => (
            <div 
              key={book.id} 
              onClick={() => {
                setSelectedBook(book);
                setSaleType('exact');
                setStudentSearch('');
                setSelectedStudentId(null);
              }}
              className="mobile-card flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:border-primary/50"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{book.title}</h3>
                  <p className="text-green-600 font-bold">{formatIQD(book.price)}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </div>
          ))
        )}
      </div>

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-scale-up">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">تۆمارکردنی فرۆشتن</p>
                  <h2 className="text-xl font-black text-gray-900">{selectedBook.title}</h2>
                </div>
                <div className="w-10 h-10" />
              </div>

              {/* Price Options */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSaleType('exact')}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                    saleType === 'exact' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-gray-50 text-gray-600 border-transparent'
                  }`}
                >
                  نرخی خۆی
                </button>
                <button
                  onClick={() => setSaleType('free')}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                    saleType === 'free' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-gray-50 text-gray-600 border-transparent'
                  }`}
                >
                  بەخشین
                </button>
                <button
                  onClick={() => setSaleType('custom')}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                    saleType === 'custom' ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-gray-50 text-gray-600 border-transparent'
                  }`}
                >
                  دەستکاری
                </button>
              </div>

              {saleType === 'custom' && (
                <div className="animate-fade-in">
                  <label className="text-xs font-bold text-gray-500 block mb-2 mr-1">نرخی دیاریکراو (دینار)</label>
                  <Input 
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="mobile-input-lg"
                    placeholder="نموونە: 1500"
                  />
                </div>
              )}

              {/* Student Selection (Optional) */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-2 mr-1">بۆ کام قوتابی؟ (ئارەزوومەندانە)</label>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      if (selectedStudentId) setSelectedStudentId(null);
                    }}
                    className="mobile-input pr-12"
                    placeholder="ناوی قوتابی بۆ گەڕان..."
                  />
                  {students.length > 0 && !selectedStudentId && (
                    <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xl bg-white z-50 absolute w-full left-0 right-0">
                      {students.map((s: any) => (
                        <div 
                          key={s.id}
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setStudentSearch(s.name);
                          }}
                          className="p-3 text-sm flex items-center gap-3 active:bg-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.gender === 'female' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{s.name}</p>
                            {s.classTime && <p className="text-xs text-gray-500">{ku.classTimes[s.classTime as keyof typeof ku.classTimes] || s.classTime}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isSearching && studentSearch.length > 0 && !selectedStudentId && (
                   <div className="mt-2 p-4 text-center text-sm text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                     دەگەڕێت...
                   </div>
                )}
              </div>

              <div className="pt-2">
                <div className="bg-gray-50 rounded-3xl p-5 mb-6 flex items-center justify-between border-2 border-dashed border-gray-200">
                  <span className="text-gray-500 font-bold">بڕی کۆتایی:</span>
                  <span className={`text-2xl font-black ${saleType === 'free' ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatIQD(saleType === 'free' ? 0 : saleType === 'custom' ? Number(customAmount) : selectedBook.price)}
                  </span>
                </div>
                
                <Button 
                  onClick={handleSale}
                  className="w-full h-16 text-xl font-black rounded-3xl shadow-xl shadow-primary/25"
                  disabled={recordSaleMutation.isPending || (saleType === 'custom' && !customAmount)}
                >
                  <CreditCard className="w-6 h-6 ml-2" />
                  {recordSaleMutation.isPending ? 'تۆمار دەکرێت...' : 'تۆمارکردنی فرۆشتن'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">فرۆشتنەکان</h2>
          <div className="text-xs font-bold text-gray-500">{sales.length} فرۆشتن</div>
        </div>
        <div className="space-y-2">
          {salesLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="mobile-card animate-pulse h-16"></div>)
          ) : sales.length === 0 ? (
            <div className="empty-state py-8">
              <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500">هیچ فرۆشتنێک نییە</p>
            </div>
          ) : (
            sales.map((sale: BookSale) => (
              <Link
                key={sale.id}
                href={`/dashboard/books/transactions?bookId=${encodeURIComponent(sale.book?.id || '')}`}
                className="mobile-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{sale.book?.title || 'کتێب'}</p>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{new Date(sale.payment?.paymentDate || Date.now()).toLocaleDateString('ku-IQ')}</span>
                      {sale.payment?.student?.name ? (
                        <span className="text-primary font-medium truncate">
                          {sale.payment.student.name}
                        </span>
                      ) : (
                        <span>نادیار</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-green-600">{formatIQD(sale.payment?.amount || 0)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
