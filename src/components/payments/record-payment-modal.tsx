'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, User, Users, Calendar, ChevronLeft, Check, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku, formatIQD } from '@/lib/translations';
import { PRICING, calculateFamilyTotal, SEMESTER } from '@/lib/billing';

interface Student {
  id: string;
  name: string;
  gender: string;
  classTime?: string;
  hasPaid?: boolean;
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedStudent?: Student | null;
}

type Step = 'mode' | 'details';
type BillingMode = 'monthly' | 'semester';
type PeriodType = 'full' | 'custom';

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
  preselectedStudent 
}: RecordPaymentModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Step management
  const [step, setStep] = useState<Step>('mode');
  
  // Billing mode
  const [billingMode, setBillingMode] = useState<BillingMode | null>(null);
  
  // Monthly mode state
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(PRICING.MONTHLY);
  
  // Semester mode state
  const [periodType, setPeriodType] = useState<PeriodType>('full');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-01-01');
  const [semesterPrice, setSemesterPrice] = useState<number>(PRICING.SINGLE_STUDENT);
  const [siblingPrice, setSiblingPrice] = useState<number>(PRICING.ADDITIONAL_SIBLING);
  
  // Student selection
  const [search, setSearch] = useState('');
  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  
  // Sibling search
  const [siblingSearch, setSiblingSearch] = useState('');
  const [showSiblingSearch, setShowSiblingSearch] = useState(false);
  
  // Notes
  const [notes, setNotes] = useState('');
  
  // Price override mode
  const [editingPrice, setEditingPrice] = useState(false);

  // Fetch students for search
  const { data: students = [] } = useQuery({
    queryKey: ['students-search', search],
    queryFn: async () => {
      if (!search || search.length < 1) return [];
      const res = await fetch(`/api/students?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: search.length > 0,
  });

  // Fetch students for sibling search
  const { data: siblingStudents = [] } = useQuery({
    queryKey: ['students-sibling-search', siblingSearch],
    queryFn: async () => {
      if (!siblingSearch || siblingSearch.length < 1) return [];
      const res = await fetch(`/api/students?search=${encodeURIComponent(siblingSearch)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: siblingSearch.length > 0 && billingMode === 'semester',
  });

  // Calculate remaining months for custom period
  const remainingMonths = useMemo(() => {
    if (periodType !== 'custom' || !customStartDate) return 6;
    const startDate = new Date(customStartDate);
    const endDate = new Date('2026-07-01');
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 
                   + (endDate.getMonth() - startDate.getMonth());
    return Math.max(1, Math.min(6, months));
  }, [periodType, customStartDate]);

  // Calculate pro-rated price for custom period
  const proRatedPrice = useMemo(() => {
    return remainingMonths * PRICING.MONTHLY;
  }, [remainingMonths]);

  // Calculate pro-rated sibling price
  const proRatedSiblingPrice = useMemo(() => {
    // Siblings get a discount - roughly same ratio
    const ratio = PRICING.ADDITIONAL_SIBLING / PRICING.SINGLE_STUDENT;
    return Math.round(proRatedPrice * ratio);
  }, [proRatedPrice]);

  // Update semester price when period type changes
  useEffect(() => {
    if (periodType === 'full') {
      setSemesterPrice(PRICING.SINGLE_STUDENT);
      setSiblingPrice(PRICING.ADDITIONAL_SIBLING);
    } else {
      setSemesterPrice(proRatedPrice);
      setSiblingPrice(proRatedSiblingPrice);
    }
  }, [periodType, proRatedPrice, proRatedSiblingPrice]);

  // Calculate total amount
  const totalAmount = useMemo(() => {
    if (billingMode === 'monthly') {
      return selectedMonths.length * monthlyPrice;
    } else {
      // Semester mode
      if (selectedStudents.length === 0) return semesterPrice;
      if (selectedStudents.length === 1) return semesterPrice;
      // Family: first student full price, rest sibling price
      return semesterPrice + (selectedStudents.length - 1) * siblingPrice;
    }
  }, [billingMode, selectedMonths, monthlyPrice, semesterPrice, siblingPrice, selectedStudents]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep('mode');
      setBillingMode(null);
      setSelectedMonths([]);
      setMonthlyPrice(PRICING.MONTHLY);
      setPeriodType('full');
      setCustomStartDate('2026-01-01');
      setSemesterPrice(PRICING.SINGLE_STUDENT);
      setSiblingPrice(PRICING.ADDITIONAL_SIBLING);
      setSelectedStudents([]);
      setSearch('');
      setSiblingSearch('');
      setShowStudentSearch(false);
      setShowSiblingSearch(false);
      setNotes('');
      setEditingPrice(false);
    }
  }, [open]);

  // Handle preselected student
  useEffect(() => {
    if (preselectedStudent && open) {
      setSelectedStudents([preselectedStudent]);
    }
  }, [preselectedStudent, open]);

  const selectMode = (mode: BillingMode) => {
    setBillingMode(mode);
    setStep('details');
    // Reset students when switching modes
    if (mode === 'monthly') {
      setSelectedStudents(selectedStudents.slice(0, 1)); // Keep only first student
    }
  };

  const toggleMonth = (monthKey: string) => {
    setSelectedMonths(prev => 
      prev.includes(monthKey) 
        ? prev.filter(m => m !== monthKey)
        : [...prev, monthKey]
    );
  };

  const addStudent = (student: Student) => {
    if (selectedStudents.find(s => s.id === student.id)) {
      toast({ title: 'ئەم قوتابییە پێشتر زیادکراوە', variant: 'destructive' });
      return;
    }
    if (selectedStudents.length >= PRICING.MAX_FAMILY_MEMBERS) {
      toast({ title: `زۆرترین ژمارەی قوتابی ${PRICING.MAX_FAMILY_MEMBERS} یە`, variant: 'destructive' });
      return;
    }
    setSelectedStudents([...selectedStudents, student]);
    setSiblingSearch('');
    setShowSiblingSearch(false);
  };

  const removeStudent = (studentId: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedStudents.length === 0) {
      toast({ title: 'تکایە قوتابییەک هەڵبژێرە', variant: 'destructive' });
      return;
    }

    if (billingMode === 'monthly' && selectedMonths.length === 0) {
      toast({ title: 'تکایە لانیکەم یەک مانگ هەڵبژێرە', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      // Determine period
      let periodStart: string;
      let periodEnd: string;
      let monthsCount: number;

      if (billingMode === 'monthly') {
        // Sort selected months and get first/last
        const sortedMonths = [...selectedMonths].sort();
        periodStart = `${sortedMonths[0]}-01`;
        const lastMonth = sortedMonths[sortedMonths.length - 1];
        periodEnd = `${lastMonth}-28`; // End of last month (approximate)
        monthsCount = selectedMonths.length;
      } else {
        // Semester mode
        if (periodType === 'full') {
          periodStart = '2026-01-01';
          periodEnd = '2026-07-01';
          monthsCount = 6;
        } else {
          periodStart = customStartDate;
          periodEnd = '2026-07-01';
          monthsCount = remainingMonths;
        }
      }

      const payload: Record<string, unknown> = {
        studentId: selectedStudents[0].id,
        amount: totalAmount,
        billingMode,
        paymentType: billingMode === 'semester' && selectedStudents.length > 1 ? 'family' : 'single',
        periodStart,
        periodEnd,
        monthsCount,
        notes: notes || null,
      };

      // Add sibling info if family payment (semester mode with multiple students)
      if (billingMode === 'semester' && selectedStudents.length > 1) {
        payload.siblingStudentIds = selectedStudents.slice(1).map(s => s.id);
        payload.siblingNames = selectedStudents.slice(1).map(s => s.name).join('، ');
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to record payment');

      toast({ title: 'پارەدان تۆمارکرا' });
      onSuccess();
    } catch (error) {
      toast({ title: 'هەڵە ڕویدا', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {step !== 'mode' && (
              <button
                onClick={() => setStep('mode')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900">تۆمارکردنی پارەدان</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Mode Selection */}
        {step === 'mode' && (
          <div className="p-4 space-y-4">
            <p className="text-gray-600 text-center mb-6">شێوازی پارەدان هەڵبژێرە</p>
            
            <button
              onClick={() => selectMode('monthly')}
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-right"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">مانگانە</h3>
                  <p className="text-gray-500 text-sm mt-1">هەر مانگێک جیاجیا</p>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-amber-600">{formatIQD(PRICING.MONTHLY)}</p>
                  <p className="text-xs text-gray-400">بۆ هەر مانگ</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => selectMode('semester')}
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-right"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">٦ مانگ بە یەکجار</h3>
                  <p className="text-gray-500 text-sm mt-1">داشکاندن بۆ خوشک و برا</p>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-green-600">{formatIQD(PRICING.SINGLE_STUDENT)}</p>
                  <p className="text-xs text-gray-400">بۆ ٦ مانگ</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            
            {/* Monthly Mode */}
            {billingMode === 'monthly' && (
              <>
                {/* Month Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">مانگەکان هەڵبژێرە</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">نرخ:</span>
                      {editingPrice ? (
                        <input
                          type="number"
                          value={monthlyPrice}
                          onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                          onBlur={() => setEditingPrice(false)}
                          className="w-20 text-sm border rounded px-2 py-1"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingPrice(true)}
                          className="flex items-center gap-1 text-primary text-sm"
                        >
                          {formatIQD(monthlyPrice)}
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SEMESTER_MONTHS.map((month) => (
                      <button
                        key={month.key}
                        type="button"
                        onClick={() => toggleMonth(month.key)}
                        className={`p-3 rounded-xl text-sm font-medium transition-all ${
                          selectedMonths.includes(month.key)
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {month.label}
                      </button>
                    ))}
                  </div>
                  {selectedMonths.length > 0 && (
                    <p className="text-center text-sm text-gray-500 mt-3">
                      {selectedMonths.length} مانگ هەڵبژێردرا
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Semester Mode */}
            {billingMode === 'semester' && (
              <>
                {/* Period Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">ماوەی پارەدان</label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setPeriodType('full')}
                      className={`p-4 rounded-xl text-center transition-all ${
                        periodType === 'full'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <p className="font-bold">وەرزی تەواو</p>
                      <p className="text-xs mt-1 opacity-80">1/1/2026 - 1/7/2026</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('custom')}
                      className={`p-4 rounded-xl text-center transition-all ${
                        periodType === 'custom'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <p className="font-bold">ماوەی دیاریکراو</p>
                      <p className="text-xs mt-1 opacity-80">بەپێی بەرواری دەستپێکردن</p>
                    </button>
                  </div>

                  {/* Custom Period Date Picker */}
                  {periodType === 'custom' && (
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">بەرواری دەستپێکردن</label>
                        <input
                          type="date"
                          value={customStartDate}
                          min="2026-01-01"
                          max="2026-06-01"
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full py-2 px-3 rounded-lg border border-gray-200"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">ماوەی ماوە:</span>
                        <span className="font-bold text-primary">{remainingMonths} مانگ</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">بڕی پارە:</span>
                        <span className="font-bold text-green-600">{formatIQD(proRatedPrice)}</span>
                      </div>
                    </div>
                  )}

                  {/* Price Override */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">نرخی کەسی یەکەم:</span>
                    {editingPrice ? (
                      <input
                        type="number"
                        value={semesterPrice}
                        onChange={(e) => setSemesterPrice(Number(e.target.value))}
                        onBlur={() => setEditingPrice(false)}
                        className="w-24 text-sm border rounded px-2 py-1"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingPrice(true)}
                        className="flex items-center gap-1 text-primary text-sm font-medium"
                      >
                        {formatIQD(semesterPrice)}
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Student Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                قوتابی <span className="text-red-500">*</span>
              </label>
              
              {selectedStudents.length > 0 ? (
                <div className="space-y-2">
                  {selectedStudents.map((student, index) => (
                    <div 
                      key={student.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        index === 0 ? 'bg-primary/10' : 'bg-purple-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        student.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                      }`}>
                        {index === 0 ? (
                          <User className={`w-5 h-5 ${student.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`} />
                        ) : (
                          <Users className={`w-5 h-5 ${student.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{student.name}</span>
                        {billingMode === 'semester' && (
                          <span className="text-xs text-green-600 mr-2">
                            ({formatIQD(index === 0 ? semesterPrice : siblingPrice)})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStudent(student.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="search"
                    placeholder="گەڕان بە ناو..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowStudentSearch(true);
                    }}
                    onFocus={() => setShowStudentSearch(true)}
                    className="pr-10 py-3"
                  />
                  
                  {showStudentSearch && students.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-auto z-20">
                      {[...students]
                        .sort((a: Student, b: Student) => {
                          if (a.hasPaid && !b.hasPaid) return 1;
                          if (!a.hasPaid && b.hasPaid) return -1;
                          return 0;
                        })
                        .map((student: Student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            if (student.hasPaid) {
                              toast({ title: 'ئەم قوتابییە پارەی داوە', variant: 'destructive' });
                              return;
                            }
                            setSelectedStudents([student]);
                            setSearch('');
                            setShowStudentSearch(false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-right ${
                            student.hasPaid ? 'opacity-60 bg-green-50' : ''
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            student.hasPaid ? 'bg-green-100' : student.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                          }`}>
                            {student.hasPaid ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <User className={`w-4 h-4 ${student.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`} />
                            )}
                          </div>
                          <span className="font-medium flex-1">{student.name}</span>
                          {student.hasPaid && (
                            <span className="text-xs text-green-600 font-medium">دراوە ✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Siblings (only for semester mode) */}
            {billingMode === 'semester' && selectedStudents.length > 0 && selectedStudents.length < PRICING.MAX_FAMILY_MEMBERS && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    زیادکردنی خوشک و برا
                  </label>
                  <span className="text-xs text-gray-400">
                    نرخ: {formatIQD(siblingPrice)}
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="search"
                    placeholder="گەڕان بۆ خوشک/برا..."
                    value={siblingSearch}
                    onChange={(e) => {
                      setSiblingSearch(e.target.value);
                      setShowSiblingSearch(true);
                    }}
                    onFocus={() => setShowSiblingSearch(true)}
                    className="pr-10 py-3"
                  />
                  
                  {showSiblingSearch && siblingStudents.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-auto z-20">
                      {[...siblingStudents]
                        .filter((s: Student) => !selectedStudents.find(sel => sel.id === s.id))
                        .map((student: Student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            if (student.hasPaid) {
                              toast({ title: 'ئەم قوتابییە پارەی داوە', variant: 'destructive' });
                              return;
                            }
                            addStudent(student);
                          }}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-right ${
                            student.hasPaid ? 'opacity-60 bg-green-50' : ''
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            student.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                          }`}>
                            <Users className={`w-4 h-4 ${student.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}`} />
                          </div>
                          <span className="font-medium flex-1">{student.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total Amount */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">کۆی گشتی:</span>
                <span className="text-3xl font-bold text-green-600">{formatIQD(totalAmount)}</span>
              </div>
              {billingMode === 'semester' && selectedStudents.length > 1 && (
                <div className="mt-2 pt-2 border-t border-green-200 space-y-1">
                  {selectedStudents.map((s, i) => (
                    <div key={s.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{s.name}</span>
                      <span className="text-green-600">{formatIQD(i === 0 ? semesterPrice : siblingPrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تێبینی</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تێبینی زیادە..."
                className="py-3"
              />
            </div>

            {/* Submit */}
            <div className="pt-2 safe-bottom">
              <Button
                type="submit"
                className="w-full py-6 text-lg bg-green-500 hover:bg-green-600 text-white rounded-xl"
                disabled={isLoading || selectedStudents.length === 0 || (billingMode === 'monthly' && selectedMonths.length === 0)}
              >
                {isLoading ? 'چاوەڕوان بە...' : `تۆمارکردن - ${formatIQD(totalAmount)}`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
