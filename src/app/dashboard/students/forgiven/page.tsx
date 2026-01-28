'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { 
  Search, 
  User, 
  UserCheck,
  ChevronDown,
  Phone,
  MapPin,
  Check,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ku } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';
import { CLASS_TIMES } from '@/lib/billing';

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
  isForgiven: boolean;
}

async function fetchForgivenStudents() {
  const res = await fetch('/api/students?status=active');
  if (!res.ok) throw new Error('Failed to fetch students');
  const data = await res.json();
  return data.filter((s: Student) => s.isForgiven);
}

export default function ForgivenStudentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = session?.user?.role === 'super_admin';
  
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-forgiven'],
    queryFn: fetchForgivenStudents,
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
      queryClient.invalidateQueries({ queryKey: ['students-forgiven'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'باری خوێندکار نوێکرایەوە' });
    },
  });

  const filteredStudents = students.filter((s: Student) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesClass = classFilter === 'all' || s.classTime === classFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold text-gray-900">خوێندکارە لێخۆشبووەکان</h1>
        <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
          {filteredStudents.length} خوێندکار
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="search"
            placeholder="گەڕان بە ناو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mobile-input pr-10"
          />
        </div>
        
        {isSuperAdmin && (
          <div className="relative">
             <select
               value={classFilter}
               onChange={(e) => setClassFilter(e.target.value)}
               className="h-12 px-4 pr-10 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium appearance-none outline-none focus:ring-2 focus:ring-primary/20"
             >
               <option value="all">هەموو کاتەکان</option>
               {CLASS_TIMES.map((time) => (
                 <option key={time} value={time}>
                   {ku.classTimes[time] || time}
                 </option>
               ))}
             </select>
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="mobile-card animate-pulse h-20"></div>
          ))
        ) : filteredStudents.length === 0 ? (
          <div className="empty-state py-12">
            <UserCheck className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">هیچ خوێندکارێکی لێخۆشبوو نییە</p>
          </div>
        ) : (
          filteredStudents.map((student: Student) => (
            <ForgivenCard 
              key={student.id} 
              student={student}
              onToggle={() => toggleForgivenMutation.mutate({ id: student.id, isForgiven: false })}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ForgivenCard({ student, onToggle }: { student: Student, onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mobile-card border-r-4 border-r-amber-500">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600`}>
          <UserCheck className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{student.name}</h3>
          <p className="text-xs text-gray-500">{ku.classTimes[student.classTime as keyof typeof ku.classTimes] || 'دیاری نەکراوە'}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

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
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="w-full py-2 px-4 rounded-lg bg-red-50 text-red-600 font-medium text-sm flex items-center justify-center gap-2"
          >
            لادانی لێخۆشبوون
          </button>
        </div>
      )}
    </div>
  );
}
