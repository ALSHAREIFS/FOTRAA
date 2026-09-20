import React, { useState, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus,
  Sparkles,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { saveBusiness } from '../lib/invoiceService';
import { validateSaudiVatNumber } from '../lib/zatcaQr';
import { Business } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessAuth: (userId: string, email: string, businessData?: Partial<Business>) => void;
  onUseDemo: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessAuth,
  onUseDemo,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingRef.current || isLoading) {
      return;
    }

    setErrorMessage(null);

    if (isRegistering) {
      if (!businessName.trim()) {
        setErrorMessage('يرجى إدخال اسم المنشأة لتسجيل الحساب');
        return;
      }
      const vatCheck = validateSaudiVatNumber(vatNumber);
      if (!vatCheck.isValid) {
        setErrorMessage(vatCheck.error || 'الرقم الضريبي غير صحيح');
        return;
      }
    }

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      if (isRegistering) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newBiz: Business = {
          id: cred.user.uid,
          name: businessName.trim(),
          nameEn: '',
          vatNumber: vatNumber.trim(),
          crNumber: '',
          address: 'المملكة العربية السعودية',
          city: 'الرياض',
          phone: '',
          email: cred.user.email || email.trim(),
          defaultVatRate: 15,
          invoicePrefix: 'INV-',
          ownerId: cred.user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveBusiness(newBiz);
        onSuccessAuth(cred.user.uid, cred.user.email || email, newBiz);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccessAuth(cred.user.uid, cred.user.email || email);
      }
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'حدث خطأ أثناء العملية: ';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'لا يوجد حساب مسجل بهذا البريد الإلكتروني';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'هذا البريد الإلكتروني مسجل مسبقاً، يمكنك تسجيل الدخول';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة جداً، يرجى اختيار 6 أحرف على الأقل';
      } else if (err.code === 'permission-denied' || (err.message && err.message.includes('permission-denied'))) {
        msg = 'تم رفض الصلاحية من قاعدة بيانات Firestore. يرجى التأكد من نشر قواعد الأمان (Firestore Rules). ' + (err.message || '');
      } else {
        msg += err.message || err.code || 'فشل الاتصال بخدمة Firebase';
      }
      setErrorMessage(msg);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-200 relative">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center mb-2 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {isRegistering ? 'إنشاء حساب منشأة جديد' : 'تسجيل الدخول إلى النظام'}
          </h2>
          <p className="text-xs text-slate-700">
            نظام فوترة إلكترونية سحابي (SaaS ZATCA)
          </p>
        </div>

        {/* Quick Demo Mode Banner */}
        <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-900">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>تجربة فورية ببيانات منشأة سعودية نموذجية</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onUseDemo();
              onClose();
            }}
            className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-300 shadow-2xs transition-colors shrink-0"
          >
            دخول تجريبي
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
          {isRegistering && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  اسم المنشأة أو المؤسسة *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="مثال: شركة الحلول الرقمية"
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الرقم الضريبي للمنشأة (15 رقم يبدأ وينتهي بـ 3) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="300123456700003"
                  className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                  dir="ltr"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              البريد الإلكتروني *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@business.com"
                className="w-full pr-9 pl-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              كلمة المرور *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-9 pl-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-emerald-700/60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isRegistering ? 'جاري إنشاء الحساب...' : 'جاري تسجيل الدخول...'}</span>
              </>
            ) : isRegistering ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب جديد وتفعيل المنشأة</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Login and Register */}
        <div className="text-center pt-2 border-t border-slate-100 text-xs">
          {isRegistering ? (
            <p className="text-slate-600">
              لديك حساب بالفعل؟{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setErrorMessage(null);
                }}
                className="font-bold text-emerald-700 hover:underline"
              >
                تسجيل الدخول هنا
              </button>
            </p>
          ) : (
            <p className="text-slate-600">
              مستخدم جديد وتريد تسجيل منشأتك؟{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setErrorMessage(null);
                }}
                className="font-bold text-emerald-700 hover:underline"
              >
                تسجيل منشأة جديدة
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
