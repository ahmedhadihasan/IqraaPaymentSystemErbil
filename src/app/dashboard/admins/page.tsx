'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Shield,
  User,
  Mail,
  Clock,
  Trash2,
  X,
  Edit,
  Check,
  XCircle,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku, formatIQD } from '@/lib/translations';
import { CLASS_TIMES } from '@/lib/billing';
import { useRouter } from 'next/navigation';

interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  assignedClassTimes: string | null;
  assignedGender?: string | null;
  todayCollection?: number;
}

async function fetchAdmins() {
  const res = await fetch('/api/admins', { 
    cache: 'no-store',
    headers: { 'Pragma': 'no-cache' } 
  });
  if (!res.ok) throw new Error('Failed to fetch admins');
  return res.json();
}

export default function AdminsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const isSuperAdmin = session?.user?.role === 'super_admin';
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  
  useEffect(() => {
    if (session && !isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [session, isSuperAdmin, router]);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: fetchAdmins,
    enabled: isSuperAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast({ title: 'بەڕێوەبەر سڕایەوە' });
    },
    onError: () => {
      toast({ title: ku.errors.generic, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast({ title: 'بەڕێوەبەر نوێکرایەوە' });
    },
    onError: () => {
      toast({ title: ku.errors.generic, variant: 'destructive' });
    },
  });

  const handleDelete = (admin: Admin) => {
    if (admin.role === 'super_admin') {
      toast({ title: 'ناتوانرێت سەرپەرشتیار بسڕێتەوە', variant: 'destructive' });
      return;
    }
    if (confirm(ku.admins.confirmDelete)) {
      deleteMutation.mutate(admin.id);
    }
  };

  const handleToggleActive = (admin: Admin) => {
    if (admin.role === 'super_admin') {
      toast({ title: 'ناتوانرێت سەرپەرشتیار بگۆڕدرێت', variant: 'destructive' });
      return;
    }
    toggleActiveMutation.mutate({ id: admin.id, isActive: !admin.isActive });
  };

  const getAssignedClassTimesDisplay = (admin: Admin) => {
    if (!admin.assignedClassTimes) return ku.classTimes.noClassAssigned;
    const times = admin.assignedClassTimes.split(',');
    return times.map(t => ku.classTimes[t as keyof typeof ku.classTimes] || t).join('، ');
  };
  const getAssignedGenderDisplay = (admin: Admin) => {
    if (!admin.assignedGender) return '';
    return admin.assignedGender === 'male' ? ku.students.male : ku.students.female;
  };

  return !isSuperAdmin ? null : (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ku.admins.title}</h1>
          <p className="text-sm text-gray-500">{ku.admins.onlySuperAdmin}</p>
        </div>
      </div>

      {/* Admins List */}
      <div className="space-y-2">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
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
        ) : (
          admins.map((admin: Admin) => (
            <div key={admin.id} className={`mobile-card ${!admin.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  admin.role === 'super_admin' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  {admin.role === 'super_admin' ? (
                    <Shield className="w-6 h-6 text-amber-600" />
                  ) : (
                    <User className="w-6 h-6 text-blue-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">
                      {admin.fullName || (admin as any).full_name || 'بێ ناو'}
                    </h3>
                    {!admin.isActive && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-600">
                        {ku.admins.inactive}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate" dir="ltr">{admin.email}</span>
                  </div>
                  
                  {/* Assigned Classes */}
                  {admin.role !== 'super_admin' && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span className="truncate">
                        {getAssignedClassTimesDisplay(admin)}
                        {getAssignedGenderDisplay(admin) ? ` • ${getAssignedGenderDisplay(admin)}` : ''}
                      </span>
                    </div>
                  )}
                  
                  {/* Today's Collection */}
                  {admin.todayCollection !== undefined && admin.todayCollection > 0 && (
                    <div className="mt-1 text-xs text-green-600 font-medium">
                      {ku.dashboard.todayCollection}: {formatIQD(admin.todayCollection)}
                    </div>
                  )}
                </div>

                {/* Role Badge */}
                <span className={`px-2 py-1 text-xs rounded-lg font-medium ${
                  admin.role === 'super_admin' 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {admin.role === 'super_admin' ? ku.admins.superAdmin : ku.admins.admin}
                </span>
              </div>
              
              {/* Actions (not for super admin) */}
              {admin.role !== 'super_admin' && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setEditingAdmin(admin)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    {ku.common.edit}
                  </button>
                  <button
                    onClick={() => handleToggleActive(admin)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-sm ${
                      admin.isActive 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {admin.isActive ? (
                      <>
                        <XCircle className="w-4 h-4" />
                        {ku.admins.deactivate}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {ku.admins.activate}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(admin)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        aria-label={ku.admins.addAdmin}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Admin Modal */}
      <AddAdminModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          queryClient.invalidateQueries({ queryKey: ['admins'] });
        }}
      />
      
      {/* Edit Admin Modal */}
      {editingAdmin && (
        <EditAdminModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSuccess={() => {
            setEditingAdmin(null);
            queryClient.invalidateQueries({ queryKey: ['admins'] });
          }}
        />
      )}
    </div>
  );
}

function AddAdminModal({ 
  open, 
  onClose, 
  onSuccess 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    assignedClassTimes: [] as string[],
    assignedGender: 'male',
  });

  const handleClassTimeToggle = (classTime: string) => {
    setFormData(prev => ({
      ...prev,
      assignedClassTimes: prev.assignedClassTimes.includes(classTime)
        ? prev.assignedClassTimes.filter(t => t !== classTime)
        : [...prev.assignedClassTimes, classTime]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assignedClassTimes: formData.assignedClassTimes.join(','),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message = typeof errorData?.error === 'string' ? errorData.error : ku.errors.generic;
        throw new Error(message);
      }

      toast({ title: 'بەڕێوەبەر زیادکرا' });
      setFormData({ fullName: '', email: '', password: '', assignedClassTimes: [], assignedGender: 'male' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : ku.errors.generic;
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">{ku.admins.addAdmin}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.admins.fullName} <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="mobile-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.admins.email} <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mobile-input"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.admins.password} <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="mobile-input"
              dir="ltr"
              required
              minLength={6}
            />
          </div>

          {/* Class Time Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.classTimes.assignedClasses}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CLASS_TIMES.map((classTime) => (
                <button
                  key={classTime}
                  type="button"
                  onClick={() => handleClassTimeToggle(classTime)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                    formData.assignedClassTimes.includes(classTime)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ku.classTimes[classTime as keyof typeof ku.classTimes] || classTime}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.students.gender}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, assignedGender: 'male' })}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  formData.assignedGender === 'male'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.male}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, assignedGender: 'female' })}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  formData.assignedGender === 'female'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.female}
              </button>
            </div>
          </div>

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
  );
}

function EditAdminModal({ 
  admin,
  onClose, 
  onSuccess 
}: { 
  admin: Admin;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: admin.fullName,
    email: admin.email,
    role: admin.role,
    assignedClassTimes: admin.assignedClassTimes?.split(',').filter(Boolean) || [],
    assignedGender: admin.assignedGender || 'male',
  });

  const handleClassTimeToggle = (classTime: string) => {
    setFormData(prev => ({
      ...prev,
      assignedClassTimes: prev.assignedClassTimes.includes(classTime)
        ? prev.assignedClassTimes.filter(t => t !== classTime)
        : [...prev.assignedClassTimes, classTime]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assignedClassTimes: formData.assignedClassTimes.join(','),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const message = typeof errorData?.error === 'string' ? errorData.error : ku.errors.generic;
        throw new Error(message);
      }

      toast({ title: 'بەڕێوەبەر نوێکرایەوە' });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : ku.errors.generic;
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-auto animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">{ku.admins.editAdmin}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.admins.fullName} <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="mobile-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {ku.admins.email} <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mobile-input"
              dir="ltr"
              required
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.admins.role}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'admin' })}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  formData.role === 'admin'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.admins.admin}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'super_admin' })}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  formData.role === 'super_admin'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.admins.superAdmin}
              </button>
            </div>
          </div>

          {/* Class Time Assignment (only for admin role) */}
          {formData.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ku.classTimes.assignedClasses}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CLASS_TIMES.map((classTime) => (
                  <button
                    key={classTime}
                    type="button"
                    onClick={() => handleClassTimeToggle(classTime)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      formData.assignedClassTimes.includes(classTime)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ku.classTimes[classTime as keyof typeof ku.classTimes] || classTime}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {formData.role === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ku.students.gender}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, assignedGender: 'male' })}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                    formData.assignedGender === 'male'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ku.students.male}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, assignedGender: 'female' })}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                    formData.assignedGender === 'female'
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ku.students.female}
                </button>
              </div>
            </div>
          )}

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
  );
}
