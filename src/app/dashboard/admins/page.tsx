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
  Calendar,
  Key,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku, formatIQD } from '@/lib/translations';
import { getClassTimeLabel } from '@/lib/billing';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, getAllRoles, isSuperAdminRole, canManageAdmins, canViewAdmins, canViewCredentials } from '@/lib/permissions';
import { useRouter } from 'next/navigation';

interface ClassTimeConfig {
  id: string;
  label: string;
  day: string;
  period: string;
  active: boolean;
}

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
  const isSuperAdmin = canManageAdmins(session?.user?.role || '');
  const canViewAdminPage = canViewAdmins(session?.user?.role || '');
  const showCredentials = canViewCredentials(session?.user?.role || '');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<Admin | null>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState('Admin@123');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showClassManager, setShowClassManager] = useState(false);
  const [newClassDay, setNewClassDay] = useState('sunday');
  const [newClassPeriod, setNewClassPeriod] = useState('morning');
  const [isAddingClass, setIsAddingClass] = useState(false);

  // Fetch dynamic class times
  const { data: classTimes = [] } = useQuery<ClassTimeConfig[]>({
    queryKey: ['classTimes'],
    queryFn: async () => {
      const res = await fetch('/api/classes');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeClassTimes = classTimes.filter((ct: ClassTimeConfig) => ct.active);

  // Fetch password reset requests
  const { data: resetRequests = [] } = useQuery({
    queryKey: ['resetRequests'],
    queryFn: async () => {
      const res = await fetch('/api/auth/forgot-password');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleResetPassword = async () => {
    if (!resetPasswordAdmin || !newPasswordForReset || newPasswordForReset.length < 6) {
      toast({ title: 'وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت', variant: 'destructive' });
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: resetPasswordAdmin.id, newPassword: newPasswordForReset }),
      });
      if (!res.ok) throw new Error('Failed to reset password');
      toast({ title: `وشەی نهێنی ${resetPasswordAdmin.fullName} ڕیسێتکرا ✅` });
      setResetPasswordAdmin(null);
      setNewPasswordForReset('Admin@123');
      queryClient.invalidateQueries({ queryKey: ['resetRequests'] });
    } catch {
      toast({ title: 'هەڵە لە ڕیسێتکردنی وشەی نهێنی', variant: 'destructive' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const dismissResetRequest = async (email: string) => {
    try {
      await fetch(`/api/auth/forgot-password?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['resetRequests'] });
    } catch {}
  };
  
  useEffect(() => {
    if (session && !canViewAdminPage) {
      router.push('/dashboard');
    }
  }, [session, canViewAdminPage, router]);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: fetchAdmins,
    enabled: canViewAdminPage,
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
      toast({ title: 'ناتوانرێت سەرپەرشتیاری سەرەکی بسڕێتەوە', variant: 'destructive' });
      return;
    }
    if (confirm(ku.admins.confirmDelete)) {
      deleteMutation.mutate(admin.id);
    }
  };

  const handleToggleActive = (admin: Admin) => {
    if (admin.role === 'super_admin') {
      toast({ title: 'ناتوانرێت سەرپەرشتیاری سەرەکی بگۆڕدرێت', variant: 'destructive' });
      return;
    }
    toggleActiveMutation.mutate({ id: admin.id, isActive: !admin.isActive });
  };

  const getAssignedClassTimesDisplay = (admin: Admin) => {
    if (!admin.assignedClassTimes) return ku.classTimes.noClassAssigned;
    const times = admin.assignedClassTimes.split(',');
    return times.map(t => {
      const ct = classTimes.find((c: ClassTimeConfig) => c.id === t);
      return ct?.label || ku.classTimes[t as keyof typeof ku.classTimes] || getClassTimeLabel(t);
    }).join('، ');
  };
  const getAssignedGenderDisplay = (admin: Admin) => {
    if (!admin.assignedGender) return '';
    return admin.assignedGender === 'male' ? ku.students.male : ku.students.female;
  };

  return !canViewAdminPage ? null : (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{ku.admins.title}</h1>
          <p className="text-sm text-gray-500">{ku.admins.onlySuperAdmin}</p>
        </div>
        {isSuperAdmin && (
        <button
          onClick={() => setShowClassManager(!showClassManager)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          {ku.admins.manageClasses}
        </button>
        )}
      </div>

      {/* Class Management Section */}
      {showClassManager && (
        <div className="mobile-card bg-purple-50 border border-purple-200">
          <h3 className="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {ku.admins.manageClasses}
          </h3>
          
          {/* Existing Classes */}
          <div className="space-y-2 mb-4">
            {classTimes.map((ct: ClassTimeConfig) => (
              <div key={ct.id} className={`flex items-center justify-between bg-white p-3 rounded-xl ${!ct.active ? 'opacity-50' : ''}`}>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{ct.label}</p>
                  <p className="text-xs text-gray-500" dir="ltr">{ct.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/classes', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: ct.id, active: !ct.active }),
                      });
                      if (res.ok) queryClient.invalidateQueries({ queryKey: ['classTimes'] });
                    }}
                    className={`px-2 py-1 text-xs rounded-lg font-medium ${
                      ct.active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {ct.active ? ku.admins.deactivate : ku.admins.activate}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('دڵنیایت لە سڕینەوەی ئەم پۆلە؟')) return;
                      const res = await fetch(`/api/classes?id=${ct.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        queryClient.invalidateQueries({ queryKey: ['classTimes'] });
                        toast({ title: 'پۆل سڕایەوە' });
                      } else {
                        const data = await res.json();
                        toast({ title: data.error || 'هەڵە', variant: 'destructive' });
                      }
                    }}
                    className="px-2 py-1 text-xs rounded-lg font-medium bg-red-100 text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Class */}
          <div className="bg-white p-3 rounded-xl space-y-3">
            <p className="text-sm font-medium text-gray-700">{ku.admins.addClass}</p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newClassDay}
                onChange={(e) => setNewClassDay(e.target.value)}
                className="py-2 px-3 rounded-xl border text-sm bg-white"
              >
                <option value="saturday">شەممە</option>
                <option value="sunday">یەکشەممە</option>
                <option value="monday">دووشەممە</option>
                <option value="tuesday">سێشەممە</option>
                <option value="wednesday">چوارشەممە</option>
                <option value="thursday">پێنجشەممە</option>
                <option value="friday">هەینی</option>
              </select>
              <select
                value={newClassPeriod}
                onChange={(e) => setNewClassPeriod(e.target.value)}
                className="py-2 px-3 rounded-xl border text-sm bg-white"
              >
                <option value="morning">بەیانی</option>
                <option value="evening">ئێوارە</option>
                <option value="night">شەو</option>
              </select>
            </div>
            <Button
              onClick={async () => {
                setIsAddingClass(true);
                try {
                  const res = await fetch('/api/classes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ day: newClassDay, period: newClassPeriod }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast({ title: 'پۆلی نوێ زیادکرا ✅' });
                    queryClient.invalidateQueries({ queryKey: ['classTimes'] });
                  } else {
                    toast({ title: data.error || 'هەڵە', variant: 'destructive' });
                  }
                } catch {
                  toast({ title: 'هەڵە', variant: 'destructive' });
                } finally {
                  setIsAddingClass(false);
                }
              }}
              disabled={isAddingClass}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              <Plus className="w-4 h-4 ml-2" />
              {isAddingClass ? 'تکایە چاوەڕێ بە...' : ku.admins.addClass}
            </Button>
          </div>
        </div>
      )}

      {/* Password Reset Requests */}
      {resetRequests.length > 0 && (
        <div className="mobile-card bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">
              داواکاری ڕیسێتکردنی وشەی نهێنی ({resetRequests.length})
            </h3>
          </div>
          <div className="space-y-2">
            {resetRequests.map((req: any) => (
              <div key={req.email} className="flex items-center justify-between bg-white p-3 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{req.name}</p>
                  <p className="text-xs text-gray-500" dir="ltr">{req.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const admin = admins.find((a: Admin) => a.email === req.email);
                      if (admin) setResetPasswordAdmin(admin);
                    }}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg font-medium hover:bg-amber-600"
                  >
                    ڕیسێتکردن
                  </button>
                  <button
                    onClick={() => dismissResetRequest(req.email)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-300"
                  >
                    ڕەتکردنەوە
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  isSuperAdminRole(admin.role) ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  {isSuperAdminRole(admin.role) ? (
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
                  {showCredentials && (
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate" dir="ltr">{admin.email}</span>
                  </div>
                  )}
                  
                  {/* Assigned Classes */}
                  {!isSuperAdminRole(admin.role) && (
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
                  isSuperAdminRole(admin.role) 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {ROLE_LABELS[admin.role] || admin.role}
                </span>
              </div>
              
              {/* Actions (only for super admin, not for the primary super admin account) */}
              {isSuperAdmin && admin.role !== 'super_admin' && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingAdmin(admin)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm"
                    >
                      <Edit className="w-4 h-4" />
                      {ku.common.edit}
                    </button>
                    <button
                      onClick={() => setResetPasswordAdmin(admin)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-50 text-amber-600 font-medium text-sm"
                    >
                      <Key className="w-4 h-4" />
                      ڕیسێتی وشەی نهێنی
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Floating Add Button (super admin only) */}
      {isSuperAdmin && (
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        aria-label={ku.admins.addAdmin}
      >
        <Plus className="w-6 h-6" />
      </button>
      )}

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

      {/* Reset Password Modal */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900">ڕیسێتکردنی وشەی نهێنی</h2>
              <button
                onClick={() => { setResetPasswordAdmin(null); setNewPasswordForReset('Admin@123'); }}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center">
                <div className="mx-auto w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-3">
                  <Key className="w-7 h-7 text-amber-600" />
                </div>
                <p className="font-bold text-gray-900">{resetPasswordAdmin.fullName}</p>
                <p className="text-sm text-gray-500" dir="ltr">{resetPasswordAdmin.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 text-right">
                  وشەی نهێنی نوێ
                </label>
                <Input
                  type="text"
                  value={newPasswordForReset}
                  onChange={(e) => setNewPasswordForReset(e.target.value)}
                  className="mobile-input text-left"
                  dir="ltr"
                  placeholder="وشەی نهێنی نوێ..."
                  minLength={6}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">وشەی نهێنی بنەڕەتی: Admin@123</p>
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword}
                className="w-full mobile-btn bg-amber-500 hover:bg-amber-600 text-white font-bold"
              >
                <RefreshCw className={`w-4 h-4 ml-2 ${isResettingPassword ? 'animate-spin' : ''}`} />
                {isResettingPassword ? 'تکایە چاوەڕێ بە...' : 'ڕیسێتکردنی وشەی نهێنی'}
              </Button>
            </div>
          </div>
        </div>
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
    role: 'admin',
    assignedClassTimes: [] as string[],
    assignedGender: 'male',
  });

  // Fetch dynamic class times
  const { data: classTimes = [] } = useQuery<ClassTimeConfig[]>({
    queryKey: ['classTimes'],
    queryFn: async () => {
      const res = await fetch('/api/classes');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeClassTimes = classTimes.filter((ct: ClassTimeConfig) => ct.active);

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
      setFormData({ fullName: '', email: '', password: '', role: 'admin', assignedClassTimes: [], assignedGender: 'male' });
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

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.admins.role} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {getAllRoles().map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.value })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors text-right ${
                    formData.role === role.value
                      ? isSuperAdminRole(role.value) ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <p>{role.label}</p>
                  <p className="text-[10px] opacity-75 mt-0.5">{role.description.substring(0, 40)}...</p>
                </button>
              ))}
            </div>
          </div>

          {/* Class Time Assignment */}
          {!isSuperAdminRole(formData.role) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.classTimes.assignedClasses}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeClassTimes.map((ct: ClassTimeConfig) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => handleClassTimeToggle(ct.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                    formData.assignedClassTimes.includes(ct.id)
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          )}
          
          {!isSuperAdminRole(formData.role) && (
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

  // Fetch dynamic class times
  const { data: classTimes = [] } = useQuery<ClassTimeConfig[]>({
    queryKey: ['classTimes'],
    queryFn: async () => {
      const res = await fetch('/api/classes');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activeClassTimes = classTimes.filter((ct: ClassTimeConfig) => ct.active);

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
              {getAllRoles().map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.value })}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors text-right ${
                    formData.role === role.value
                      ? isSuperAdminRole(role.value) ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <p>{role.label}</p>
                  <p className="text-[10px] opacity-75 mt-0.5">{role.description.substring(0, 40)}...</p>
                </button>
              ))}
            </div>
          </div>

          {/* Class Time Assignment (only for admin roles) */}
          {!isSuperAdminRole(formData.role) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ku.classTimes.assignedClasses}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {activeClassTimes.map((ct: ClassTimeConfig) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => handleClassTimeToggle(ct.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      formData.assignedClassTimes.includes(ct.id)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {!isSuperAdminRole(formData.role) && (
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
