'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  BookOpen, 
  CreditCard,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ku, formatIQD } from '@/lib/translations';
import { useToast } from '@/hooks/use-toast';

interface Book {
  id: string;
  title: string;
  price: number;
  active: boolean;
}

export default function ManageBooksPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = session?.user?.role === 'super_admin';

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', price: '' });
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const res = await fetch('/api/books');
      if (!res.ok) throw new Error('Failed to fetch books');
      return res.json();
    },
  });

  const createBookMutation = useMutation({
    mutationFn: async (data: { title: string; price: number }) => {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'create' }),
      });
      if (!res.ok) throw new Error('Failed to create book');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowModal(false);
      setFormData({ title: '', price: '' });
      toast({ title: 'کتێب بە سەرکەوتوویی زیاد کرا' });
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; price: number }) => {
      const res = await fetch('/api/books', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update book');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowModal(false);
      setEditingId(null);
      setFormData({ title: '', price: '' });
      toast({ title: 'کتێب بە سەرکەوتوویی نوێکرایەوە' });
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/books?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete book');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowDeleteDialog(false);
      setDeletingId(null);
      toast({ title: 'کتێب سڕایەوە' });
    },
  });

  const handleOpenAdd = () => {
    setModalMode('create');
    setFormData({ title: '', price: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (book: Book) => {
    setModalMode('edit');
    setEditingId(book.id);
    setFormData({ title: book.title, price: book.price.toString() });
    setShowModal(true);
  };

  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleSubmit = () => {
    if (modalMode === 'create') {
      createBookMutation.mutate({ 
        title: formData.title, 
        price: Number(formData.price) 
      });
    } else {
      if (!editingId) return;
      updateBookMutation.mutate({ 
        id: editingId,
        title: formData.title, 
        price: Number(formData.price) 
      });
    }
  };

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-500 font-bold">ببوورە تەنها سەرپەرشتیار دەتوانێت ئەم لاپەڕەیە ببینێت</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">بەڕێوەبردنی کتێبەکان</h1>
        <Button onClick={handleOpenAdd} className="mobile-btn">
          <Plus className="w-5 h-5 ml-2" />
          کتێبی نوێ
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <div key={i} className="mobile-card animate-pulse h-20"></div>)
        ) : (
          books.map((book: Book) => (
            <div key={book.id} className="mobile-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{book.title}</h3>
                  <p className="text-sm text-green-600 font-bold">{formatIQD(book.price)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenEdit(book)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleOpenDelete(book.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                {modalMode === 'create' ? 'زیادکردنی کتێب' : 'دەستکاریکردنی کتێب'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">ناوی کتێب</label>
                <Input 
                  value={formData.title} 
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="mobile-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">نرخ (دینار)</label>
                <Input 
                  type="number"
                  value={formData.price} 
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="mobile-input"
                />
              </div>
              <Button 
                onClick={handleSubmit}
                className="w-full py-4 text-lg"
                disabled={createBookMutation.isPending || updateBookMutation.isPending || !formData.title || !formData.price}
              >
                {createBookMutation.isPending || updateBookMutation.isPending ? 'خەریکی پاشکەوتکردنە...' : 'پاشکەوتکردن'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-scale-up">
            <h2 className="text-lg font-bold text-gray-900 mb-2">دڵنیای لە سڕینەوە؟</h2>
            <p className="text-gray-500 mb-6">ئەم کتێبە دەسڕێتەوە و گەڕاندنەوەی نییە.</p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowDeleteDialog(false)}
              >
                پەشیمانم
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={() => deletingId && deleteBookMutation.mutate(deletingId)}
                disabled={deleteBookMutation.isPending}
              >
                {deleteBookMutation.isPending ? 'دەسڕێتەوە...' : 'بسرەوە'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
