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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
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

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      toast({
        title: 'تکایە ئیمەیڵەکەت بنووسە',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (res.ok) {
        setResetSent(true);
        toast({
          title: 'داواکاری نێردرا ✅',
          description: 'تکایە پەیوەندی بە سەرپەرشتیار بکە بۆ ڕیسێتکردنی وشەی نهێنی',
        });
      } else {
        toast({
          title: 'هەڵەیەک ڕوویدا',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: ku.errors.network,
        variant: 'destructive',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] p-4">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 w-24 h-24 rounded-2xl overflow-hidden bg-white shadow-xl">
          <img 
            src="/logo.jpg" 
            alt="رێکخراوی اقرا - لقی هەولێر" 
            className="h-full w-full object-cover" 
          />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{ku.appName}</h1>
        <p className="text-white/80 text-sm">{ku.auth.subtitle}</p>
      </div>

      {/* Login Form or Forgot Password */}
      <div className="w-full max-w-sm">
        {!showForgotPassword ? (
          <>
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

            {/* Forgot Password Link */}
            <button
              onClick={() => {
                setShowForgotPassword(true);
                setResetSent(false);
                setForgotEmail('');
              }}
              className="w-full text-center mt-4 text-white/70 hover:text-white text-sm underline transition-colors"
            >
              وشەی نهێنیت بیرچووەتەوە؟
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {!resetSent ? (
              <>
                <div className="text-center mb-4">
                  <h2 className="text-white text-lg font-bold mb-2">ڕیسێتکردنی وشەی نهێنی</h2>
                  <p className="text-white/70 text-sm">
                    ئیمەیڵەکەت بنووسە، داواکاریەکەت دەنێردرێت بۆ سەرپەرشتیار
                  </p>
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="ئیمەیڵەکەت بنووسە..."
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="mobile-input bg-white/95 border-0 text-gray-900 placeholder:text-gray-500"
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                  />
                </div>
                <Button
                  onClick={handleForgotPassword}
                  className="w-full mobile-btn bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold text-lg"
                  disabled={isSendingReset}
                >
                  {isSendingReset ? 'تکایە چاوەڕێ بە...' : 'ناردنی داواکاری'}
                </Button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <h2 className="text-white text-lg font-bold">داواکاری نێردرا</h2>
                <p className="text-white/70 text-sm leading-relaxed">
                  تکایە پەیوەندی بە سەرپەرشتیار بکە و بڵێ کە داوای ڕیسێتکردنی وشەی نهێنیت ناردووە.
                  <br />
                  سەرپەرشتیار وشەی نهێنیت بۆ دەگۆڕێت.
                </p>
              </div>
            )}

            {/* Back to Login */}
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setForgotEmail('');
              }}
              className="w-full text-center mt-2 text-white/70 hover:text-white text-sm underline transition-colors"
            >
              گەڕانەوە بۆ چوونەژوورەوە
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-white/60 text-xs">
        © 2026 {ku.appName}
      </p>
    </div>
  );
}
