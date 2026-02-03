'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  Search, 
  User, 
  Users, 
  Calendar, 
  Check, 
  CreditCard,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku, formatIQD } from '@/lib/translations';
import { PRICING, calculateFamilyTotal, SEMESTER } from '@/lib/billing';
import { toEnglishNumerals } from '@/lib/text-utils';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  gender: string;
  classTime?: string;
  hasPaid?: boolean;
  billingPreference?: string;
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStudent?: Student | null;
  lockedBillingType?: 'semester' | 'monthly';
  defaultBillingType?: 'semester' | 'monthly';
  lockedMonth?: string; // e.g. '2026-01' - locks to single month payment
}

// Month definitions for the semester
const SEMESTER_MONTHS = [
  { key: '2026-01', label: 'کانوونی دووەم', labelEn: 'January' },
  { key: '2026-02', label: 'شوبات', labelEn: 'February' },
  { key: '2026-03', label: 'ئازار', labelEn: 'March' },
  { key: '2026-04', label: 'نیسان', labelEn: 'April' },
  { key: '2026-05', label: 'ئایار', labelEn: 'May' },
  { key: '2026-06', label: 'حوزەیران', labelEn: 'June' },
];

export function RecordPaymentModal({ 
  open, 
  onClose, 
  onSuccess,
  preselectedStudent,
  lockedBillingType,
  defaultBillingType,
  lockedMonth,
}: RecordPaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // -- State --
  
  // Billing Config
  const [billingType, setBillingType] = useState<'semester' | 'monthly'>(() => lockedBillingType ?? defaultBillingType ?? 'semester');
  const [priceMode, setPriceMode] = useState<'standard' | 'free' | 'custom'>('standard');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [updateStudentPreference, setUpdateStudentPreference] = useState(false);
  
  // Monthly State
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  
  // Semester State
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('2026-01-01');

  // Student Selection
  const [search, setSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);

  // Notes
  const [notes, setNotes] = useState('');

  const canModifyBillingType = !lockedBillingType;

  // -- Queries --

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['students-search', search],
    queryFn: async () => {
      if (!search || search.length < 1) return [];
      const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&forTransaction=true`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: search.length > 0,
  });

  // Fetch existing payments for selected students to check which months are already paid
  const selectedStudentIds = selectedStudents.map(s => s.id);
  const { data: existingPayments = [] } = useQuery({
    queryKey: ['modal-student-payments', selectedStudentIds.join(',')],
    queryFn: async () => {
      if (selectedStudentIds.length === 0) return [];
      // Use the studentIds parameter for efficient fetching
      const res = await fetch(`/api/payments?studentIds=${selectedStudentIds.join(',')}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.payments || [];
    },
    enabled: selectedStudentIds.length > 0,
  });

  // Calculate which months are already paid for the primary student
  const paidMonths = useMemo(() => {
    const paid = new Set<string>();
    if (selectedStudents.length === 0) return paid;
    
    const primaryStudentId = selectedStudents[0].id;
    const studentPayments = existingPayments.filter((p: any) => p.studentId === primaryStudentId);
    
    SEMESTER_MONTHS.forEach(month => {
      const monthStart = new Date(`${month.key}-01`);
      const isPaid = studentPayments.some((payment: any) => {
        const periodStart = new Date(payment.periodStart);
        const periodEnd = new Date(payment.periodEnd);
        return monthStart >= periodStart && monthStart < periodEnd;
      });
      if (isPaid) {
        paid.add(month.key);
      }
    });
    
    return paid;
  }, [selectedStudents, existingPayments]);

  // -- Effects --

  useEffect(() => {
    if (open) {
      // Reset state
      setPriceMode('standard');
      setCustomAmount('');
      setUseCustomStart(false);
      setCustomStartDate('2026-01-01');
      setSearch('');
      setNotes('');
      setUpdateStudentPreference(false);
      
      // Set selected months - if locked to a specific month, only select that one
      if (lockedMonth) {
        setSelectedMonths([lockedMonth]);
      } else {
        setSelectedMonths([]);
      }
      
      if (preselectedStudent) {
        setSelectedStudents([preselectedStudent]);
        // Set billing type based on student's preference unless locked or default is specified
        if (lockedBillingType) {
          setBillingType(lockedBillingType);
        } else if (defaultBillingType) {
          setBillingType(defaultBillingType);
          // If default differs from student's preference, auto-check the update preference option
          const studentPref = preselectedStudent.billingPreference || 'semester';
          if (studentPref !== defaultBillingType) {
            setUpdateStudentPreference(true);
          }
        } else {
          const studentPref = (preselectedStudent as any).billingPreference;
          setBillingType(studentPref === 'monthly' ? 'monthly' : 'semester');
        }
      } else {
        setSelectedStudents([]);
        setBillingType(lockedBillingType ?? defaultBillingType ?? 'semester');
      }
    }
  }, [open, preselectedStudent, lockedBillingType, defaultBillingType, lockedMonth]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
      
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      };
    }
  }, [open]);

  // -- Calculations --

  const standardAmount = useMemo(() => {
    const studentCount = selectedStudents.length;
    if (studentCount === 0) return 0;

    if (billingType === 'monthly') {
      // Monthly: (Months * Price) * Students
      // Usually monthly is per student, no sibling discount logic defined for monthly in PRICING constant explicitly, 
      // but let's assume standard price per student.
      return selectedMonths.length * PRICING.MONTHLY * studentCount;
    } else {
      // Semester: Use family calculation
      let total = calculateFamilyTotal(studentCount);
      
      // Pro-rate if custom start date
      if (useCustomStart && customStartDate) {
        const start = new Date(customStartDate);
        const end = new Date('2026-07-01');
        // Approximate months remaining
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        const remainingMonths = Math.max(1, Math.min(6, months));
        
        // Ratio of remaining / 6
        const ratio = remainingMonths / 6;
        total = Math.round(total * ratio / 1000) * 1000; // Round to nearest 1000
      }
      
      return total;
    }
  }, [billingType, selectedStudents.length, selectedMonths.length, useCustomStart, customStartDate]);

  const finalAmount = useMemo(() => {
    if (priceMode === 'free') return 0;
    if (priceMode === 'custom') return Number(customAmount) || 0;
    return standardAmount;
  }, [priceMode, customAmount, standardAmount]);

  // -- Handlers --

  const toggleStudent = (student: Student) => {
    if (selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents(prev => prev.filter(s => s.id !== student.id));
      return;
    }
    if (student.hasPaid) {
      toast({ title: 'ئەم قوتابییە پارەی داوە بۆ ئەم وەرزە', variant: 'destructive' });
      return;
    }
    
    // If this is the first student being added, set billing type based on their preference
    if (canModifyBillingType && selectedStudents.length === 0 && student.billingPreference) {
      setBillingType(student.billingPreference === 'monthly' ? 'monthly' : 'semester');
    }
    
    // For monthly payments, only allow one student (no siblings)
    if (billingType === 'monthly') {
      setSelectedStudents([student]);
    } else {
      setSelectedStudents(prev => [...prev, student]);
    }
    setSearch('');
  };

  const toggleMonth = (key: string) => {
    setSelectedMonths(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (selectedStudents.length === 0) throw new Error('No students selected');
      
      // For monthly payments, validate that months are selected
      if (billingType === 'monthly' && selectedMonths.length === 0) {
        throw new Error('تکایە مانگەکان هەڵبژێرە');
      }

      // Update student billing preferences if requested
      if (updateStudentPreference) {
        for (const student of selectedStudents) {
          if (student.billingPreference !== billingType) {
            await fetch(`/api/students/${student.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ billingPreference: billingType }),
            });
          }
        }
      }

      const mainStudent = selectedStudents[0];
      const siblings = selectedStudents.slice(1);

      // Calculate period for monthly payments based on selected months
      let periodStart: string | undefined;
      let periodEnd: string | undefined;
      
      if (billingType === 'monthly' && selectedMonths.length > 0) {
        // For monthly payments, we create ONE payment per month to avoid the range bug
        // If multiple months selected, we need to create multiple payments
        const sortedMonths = [...selectedMonths].sort();
        
        if (sortedMonths.length === 1) {
          // Single month - simple case
          const [year, month] = sortedMonths[0].split('-').map(Number);
          periodStart = `${sortedMonths[0]}-01`;
          const lastDay = new Date(year, month, 0).getDate();
          periodEnd = `${sortedMonths[0]}-${lastDay}`;
        } else {
          // Multiple months - only allow consecutive months, or create separate payments
          // Check if months are consecutive
          let areConsecutive = true;
          for (let i = 1; i < sortedMonths.length; i++) {
            const [prevYear, prevMonth] = sortedMonths[i-1].split('-').map(Number);
            const [currYear, currMonth] = sortedMonths[i].split('-').map(Number);
            const expectedNext = prevMonth === 12 ? `${prevYear + 1}-01` : `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
            if (sortedMonths[i] !== expectedNext) {
              areConsecutive = false;
              break;
            }
          }
          
          if (!areConsecutive) {
            throw new Error('تکایە تەنها مانگە پەیوەندیدارەکان هەڵبژێرە (مانگە دوای یەک) یان هەر مانگێک جیا پارە بدە');
          }
          
          periodStart = `${sortedMonths[0]}-01`;
          const lastMonth = sortedMonths[sortedMonths.length - 1];
          const [year, month] = lastMonth.split('-').map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          periodEnd = `${lastMonth}-${lastDay}`;
        }
      } else if (billingType === 'semester') {
        periodStart = useCustomStart ? customStartDate : '2026-01-01';
        periodEnd = '2026-07-01';
      }

      const payload = {
        studentId: mainStudent.id,
        siblingStudentIds: siblings.map(s => s.id),
        amount: finalAmount,
        paymentType: selectedStudents.length > 1 ? 'family' : 'single',
        billingMode: billingType,
        monthsCount: billingType === 'monthly' ? selectedMonths.length : 6,
        periodStart,
        periodEnd,
        notes,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record payment');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'پارەدان بە سەرکەوتوویی تۆمارکرا' });
      // Invalidate all relevant queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['all-payments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-students'] });
      queryClient.invalidateQueries({ queryKey: ['student-payments'] });
      queryClient.invalidateQueries({ queryKey: ['modal-student-payments'] });
      queryClient.invalidateQueries({ queryKey: ['semester-students'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: 'هەڵە ڕوویدا', description: err.message, variant: 'destructive' });
    },
  });

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full sm:max-w-4xl bg-white sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col"
        style={{ 
          maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - 1rem)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-900">تۆمارکردنی پارەدان</h2>
            <p className="text-sm text-gray-500 font-medium">زانیارییەکان پڕبکەرەوە</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-x-reverse min-h-full">
            
            {/* LEFT COLUMN: Student Selection */}
            <div className="p-6 space-y-6 bg-gray-50/30">
              {/* Hide search when monthly mode and a student is already selected */}
              {!(billingType === 'monthly' && selectedStudents.length > 0) && (
              <div className="relative">
                <label className="text-sm font-bold text-gray-700 mb-2 block">قوتابی هەڵبژێرە</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    placeholder="ناوی قوتابی..." 
                    className="pr-10 bg-white shadow-sm border-gray-200 focus:ring-primary h-12 text-lg"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                
                {/* Search Results */}
                {search.length > 0 && (
                  <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden max-h-60 overflow-y-auto absolute z-10 left-0 right-0">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500">دەگەڕێت...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">هیچ قوتابییەک نەدۆزرایەوە</div>
                    ) : (
                      searchResults.map((s: Student) => {
                        const isSelected = selectedStudents.find(sel => sel.id === s.id);
                        const isPaid = Boolean(s.hasPaid);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleStudent(s)}
                            disabled={isPaid}
                            className={cn(
                              "w-full p-3 text-right flex flex-row-reverse items-center gap-3 border-b last:border-0",
                              isPaid ? "bg-green-50 text-green-700 cursor-not-allowed" : "hover:bg-gray-50"
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                <User className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <p className="font-bold text-gray-900 truncate">{s.name}</p>
                                <p className="text-xs text-gray-500 truncate">{s.classTime || 'کات دیاری نەکراوە'}</p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              {isSelected ? (
                                <Check className="w-5 h-5 text-green-500" />
                              ) : isPaid ? (
                                <span className="text-xs font-semibold text-green-700 whitespace-nowrap">✓ دراوە</span>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Selected Students List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {billingType === 'monthly' ? 'قوتابی' : `قوتابیانی دیاریکراو (${selectedStudents.length})`}
                  </h3>
                  {billingType === 'semester' && selectedStudents.length > 1 && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">خوشک و برا</span>
                  )}
                </div>
                
                {/* Monthly mode notice - no siblings allowed */}
                {billingType === 'monthly' && selectedStudents.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">تەنها یەک قوتابی دەتوانیت هەڵبژێریت بۆ پارەدانی مانگانە</p>
                )}
                
                {selectedStudents.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-medium">هیچ قوتابییەک دیاری نەکراوە</p>
                  </div>
                ) : (
                  selectedStudents.map(student => (
                    <div key={student.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between animate-scale-up">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${student.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.classTime}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleStudent(student)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Payment Details */}
            <div className="p-6 flex flex-col h-full">
              <div className="flex-1 space-y-6">
                
                {/* Billing Type Tabs */}
                <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                  <button
                    onClick={() => {
                      if (!canModifyBillingType) return;
                      setBillingType('semester');
                    }}
                    disabled={lockedBillingType === 'monthly'}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      billingType === 'semester' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                      lockedBillingType === 'monthly' ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    وەرز (Semester)
                  </button>
                  <button
                    onClick={() => {
                      if (!canModifyBillingType) return;
                      setBillingType('monthly');
                    }}
                    disabled={lockedBillingType === 'semester'}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
                      billingType === 'monthly' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                      lockedBillingType === 'semester' ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                    مانگانە
                  </button>
                </div>

                {/* Update Student Preference Checkbox */}
                {selectedStudents.length > 0 && selectedStudents.some(s => s.billingPreference !== billingType) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
                    <input 
                      type="checkbox" 
                      id="updateStudentPreference"
                      checked={updateStudentPreference}
                      onChange={e => setUpdateStudentPreference(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="updateStudentPreference" className="text-sm font-medium text-amber-800">
                      {billingType === 'monthly' 
                        ? 'گۆڕینی قوتابی بۆ پارەدانی مانگانە بۆ داهاتوو'
                        : 'گۆڕینی قوتابی بۆ پارەدانی وەرزی بۆ داهاتوو'}
                    </label>
                  </div>
                )}

                {/* Type Specific Content */}
                <div className="min-h-[200px]">
                  {billingType === 'semester' ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <p className="font-bold text-blue-900">بەشداری وەرز (6 مانگ)</p>
                        </div>
                        <p className="text-sm text-blue-700/80 leading-relaxed">
                          نرخی ئاسایی 25,000 دینارە بۆ هەر خوێندکارێک. بۆ خوشک و براکان داشکاندن دەکرێت.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="useCustomStart"
                          checked={useCustomStart}
                          onChange={e => setUseCustomStart(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="useCustomStart" className="text-sm font-medium text-gray-700">
                          دەستپێک جگە لە سەرەتای ساڵ (Pro-rated)
                        </label>
                      </div>
                      
                      {useCustomStart && (
                        <div className="animate-fade-in">
                           <Input 
                             type="date" 
                             value={customStartDate}
                             onChange={e => setCustomStartDate(e.target.value)}
                             className="bg-gray-50 border-gray-200"
                           />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                       {lockedMonth ? (
                         // Single month payment mode - show only the locked month
                         <div className="bg-primary/10 border-2 border-primary rounded-xl p-4 text-center">
                           <p className="text-sm font-medium text-gray-500 mb-2">پارەدان بۆ:</p>
                           <p className="text-xl font-bold text-primary">
                             {SEMESTER_MONTHS.find(m => m.key === lockedMonth)?.label}
                           </p>
                           <p className="text-sm text-gray-500 mt-1">
                             {formatIQD(PRICING.MONTHLY)}
                           </p>
                         </div>
                       ) : (
                         // Multi-month selection mode
                         <>
                           <p className="text-sm font-medium text-gray-500 mb-2">مانگەکان دیاری بکە:</p>
                           <div className="grid grid-cols-3 gap-2">
                             {SEMESTER_MONTHS.map(m => {
                               const isAlreadyPaid = paidMonths.has(m.key);
                               const isSelected = selectedMonths.includes(m.key);
                               
                               return (
                                 <button
                                   key={m.key}
                                   onClick={() => !isAlreadyPaid && toggleMonth(m.key)}
                                   disabled={isAlreadyPaid}
                                   className={cn(
                                     "py-2 px-1 rounded-lg text-xs font-bold border-2 transition-all relative",
                                     isAlreadyPaid
                                       ? "border-green-300 bg-green-100 text-green-700 cursor-not-allowed"
                                       : isSelected 
                                         ? "border-primary bg-primary/5 text-primary" 
                                         : "border-transparent bg-gray-50 text-gray-600 hover:bg-gray-100"
                                   )}
                                 >
                                   {isAlreadyPaid && (
                                     <Check className="w-3 h-3 absolute top-1 left-1 text-green-600" />
                                   )}
                                   {m.label}
                                   {isAlreadyPaid && (
                                     <span className="block text-[10px] text-green-600 mt-0.5">دراوە</span>
                                   )}
                                 </button>
                               );
                             })}
                           </div>
                         </>
                       )}
                       <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between">
                         <span className="text-sm text-gray-600">نرخی مانگانە:</span>
                         <span className="font-bold text-gray-900">{formatIQD(PRICING.MONTHLY)} / مانگ</span>
                       </div>
                    </div>
                  )}
                </div>

                {/* Price Mode */}
                <div>
                   <label className="text-sm font-bold text-gray-700 mb-2 block">جۆری نرخ</label>
                   <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPriceMode('standard')}
                        className={cn(
                          "py-3 rounded-xl text-sm font-bold border-2 transition-all",
                          priceMode === 'standard' 
                            ? "border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20" 
                            : "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        ئاسایی
                      </button>
                      <button
                        onClick={() => setPriceMode('free')}
                        className={cn(
                          "py-3 rounded-xl text-sm font-bold border-2 transition-all",
                          priceMode === 'free' 
                            ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                            : "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        بەخۆڕایی (لێخۆشبوون)
                      </button>
                      <button
                        onClick={() => setPriceMode('custom')}
                        className={cn(
                          "py-3 rounded-xl text-sm font-bold border-2 transition-all",
                          priceMode === 'custom' 
                            ? "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                            : "border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        دەستکاری
                      </button>
                   </div>
                </div>

                {priceMode === 'custom' && (
                  <div className="animate-fade-in">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">بڕی پارە (دینار)</label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={e => setCustomAmount(toEnglishNumerals(e.target.value))}
                      placeholder="نموونە: 10000"
                      className="text-lg font-bold"
                      dir="ltr"
                    />
                  </div>
                )}
                
                {/* Notes */}
                <div>
                   <label className="text-xs font-bold text-gray-500 mb-1 block">تێبینی (ئارەزوومەندانە)</label>
                   <Input 
                     value={notes} 
                     onChange={e => setNotes(e.target.value)}
                     className="bg-gray-50 border-gray-200"
                   />
                </div>
              </div>

              {/* Footer / Total */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 font-medium">کۆی گشتی</span>
                  <span className="text-3xl font-black text-gray-900">{formatIQD(finalAmount)}</span>
                </div>
                
                <Button 
                  className="w-full py-6 text-lg font-bold rounded-xl shadow-xl shadow-primary/20"
                  onClick={() => recordPaymentMutation.mutate()}
                  disabled={selectedStudents.length === 0 || recordPaymentMutation.isPending}
                >
                  {recordPaymentMutation.isPending ? 'خەریکە...' : 'تۆمارکردنی پارەدان'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
