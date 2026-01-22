'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ku } from '@/lib/translations';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: ku.errors.generic,
          description: ku.auth.loginError,
          variant: 'destructive',
        });
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      toast({
        title: ku.errors.generic,
        description: ku.errors.network,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-4">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 w-24 h-24 rounded-2xl overflow-hidden bg-white shadow-xl">
          <img 
            src="/logo.jpg" 
            alt="ئیقرائ" 
            className="h-full w-full object-cover" 
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{ku.appName}</h1>
        <p className="text-white/80 text-sm">{ku.auth.subtitle}</p>
      </div>

      {/* Login Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder={ku.auth.email}
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              className="mobile-input bg-white/95 border-0 text-gray-900 placeholder:text-gray-500 text-right"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder={ku.auth.password}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              className="mobile-input bg-white/95 border-0 text-gray-900 placeholder:text-gray-500"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full mobile-btn bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold text-lg"
            disabled={isLoading}
          >
            {isLoading ? ku.auth.loggingIn : ku.auth.loginButton}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-white/60 text-xs">
        © 2026 {ku.appName}
      </p>
    </div>
  );
}
