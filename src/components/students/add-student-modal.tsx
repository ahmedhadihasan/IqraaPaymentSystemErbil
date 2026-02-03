'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku } from '@/lib/translations';
import { CLASS_TIMES } from '@/lib/billing';
import { toEnglishNumerals } from '@/lib/text-utils';

interface Student {
  id?: string;
  name: string;
  gender: string;
  birthYear: string | null;
  address: string | null;
  phone: string | null;
  financialStatus: string | null;
  classTime: string | null;
  billingPreference?: string;
}

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  student?: Student | null;
  defaultGender?: string;
  defaultClassTime?: string;
}

const classTimeLabels: Record<string, string> = {
  saturday_morning: ku.classTimes.saturday_morning,
  saturday_evening: ku.classTimes.saturday_evening,
  saturday_night: ku.classTimes.saturday_night,
  monday_evening: ku.classTimes.monday_evening,
  tuesday_night: ku.classTimes.tuesday_night,
  wednesday_evening: ku.classTimes.wednesday_evening,
  wednesday_night: ku.classTimes.wednesday_night,
  thursday_night: ku.classTimes.thursday_night,
};

export function AddStudentModal({ open, onClose, onSuccess, student, defaultGender, defaultClassTime }: AddStudentModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<Student, 'id'>>({
    name: '',
    gender: defaultGender || 'male',
    birthYear: '',
    address: '',
    phone: '',
    financialStatus: '',
    classTime: defaultClassTime || '',
    billingPreference: 'semester',
  });

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        gender: student.gender,
        birthYear: student.birthYear || '',
        address: student.address || '',
        phone: student.phone || '',
        financialStatus: student.financialStatus || '',
        classTime: student.classTime || '',
        billingPreference: student.billingPreference || 'semester',
      });
    } else {
      setFormData({
        name: '',
        gender: defaultGender || 'male',
        birthYear: '',
        address: '',
        phone: '',
        financialStatus: '',
        classTime: defaultClassTime || '',
        billingPreference: 'semester',
      });
    }
  }, [student, open, defaultGender, defaultClassTime]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = student ? `/api/students/${student.id}` : '/api/students';
      const method = student ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          birthYear: formData.birthYear || null,
          address: formData.address || null,
          phone: formData.phone || null,
          financialStatus: formData.financialStatus || null,
          billingPreference: formData.billingPreference || 'semester',
        }),
      });

      if (!res.ok) throw new Error('Failed to save student');

      toast({
        title: student ? ku.students.studentUpdated : ku.students.studentAdded,
      });
      onSuccess();
    } catch (error) {
      toast({
        title: ku.errors.generic,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up flex flex-col"
        style={{ 
          maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - 1rem)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {student ? ku.students.editStudent : ku.students.addStudent}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.students.fullName} <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mobile-input"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.students.gender} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'male' })}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  formData.gender === 'male'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.male}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: 'female' })}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  formData.gender === 'female'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.female}
              </button>
            </div>
          </div>

          {/* Birth Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.students.birthYear}
            </label>
            <Input
              value={formData.birthYear || ''}
              onChange={(e) => setFormData({ ...formData, birthYear: toEnglishNumerals(e.target.value) })}
              className="mobile-input"
              placeholder="2010"
              dir="ltr"
            />
          </div>

          {/* Class Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.students.classTime}
            </label>
            <select
              value={formData.classTime || ''}
              onChange={(e) => setFormData({ ...formData, classTime: e.target.value })}
              className="w-full mobile-input bg-white border border-gray-200 rounded-xl px-4 py-3"
            >
              <option value="">{ku.students.selectClassTime}</option>
              {CLASS_TIMES.map((ct) => (
                <option key={ct} value={ct}>
                  {classTimeLabels[ct]}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              جۆری پارەدان
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, billingPreference: 'semester' })}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  formData.billingPreference === 'semester'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                وەرزی
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, billingPreference: 'monthly' })}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  formData.billingPreference === 'monthly'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                مانگانە
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.students.phone}
            </label>
            <Input
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: toEnglishNumerals(e.target.value) })}
              className="mobile-input"
              placeholder="0750 123 4567"
              dir="ltr"
              type="tel"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.students.address}
            </label>
            <Input
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="mobile-input"
              placeholder="هەولێر"
            />
          </div>

          {/* Financial Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.students.financialStatus}
            </label>
            <Input
              value={formData.financialStatus || ''}
              onChange={(e) => setFormData({ ...formData, financialStatus: e.target.value })}
              className="mobile-input"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 safe-bottom">
            <Button
              type="submit"
              className="w-full mobile-btn bg-primary text-white"
              disabled={isLoading}
            >
              {isLoading ? ku.common.loading : ku.common.save}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
