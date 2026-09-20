import React from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  LogOut,
  User,
  FlaskConical,
  Plus,
} from 'lucide-react';
import { Business } from '../types';

interface NavbarProps {
  business: Business;
  isDemo: boolean;
  onOpenNewInvoice: () => void;
  onOpenTests: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  business,
  isDemo,
  onOpenNewInvoice,
  onOpenTests,
  onOpenAuth,
  onLogout,
  onNavigate,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & App Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-3 text-right group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs font-bold text-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-lg tracking-tight group-hover:text-emerald-700 transition-colors">
                    فاتورة سريعة
                  </span>
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    SaaS ZATCA
                  </span>
                </div>
                <p className="text-xs text-slate-700 hidden sm:block">
                  نظام الفوترة الإلكترونية السحابي
                </p>
              </div>
            </button>

            {/* ZATCA Phase 1 Badge */}
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded-md border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>دعم متطلبات الفوترة الإلكترونية (ZATCA)</span>
            </div>
          </div>

          {/* Actions & Business / User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Diagnostics / Tests Button */}
            <button
              onClick={onOpenTests}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
              title="فحص النظام واختبارات المعايير الحسابية"
            >
              <FlaskConical className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">فحص النظام والاختبارات</span>
              <span className="sm:hidden">الاختبارات</span>
            </button>

            {/* New Invoice Button */}
            <button
              onClick={onOpenNewInvoice}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار فاتورة</span>
            </button>

            {/* Business info badge */}
            <div className="hidden lg:flex items-center gap-2 pl-3 border-r border-slate-200 mr-2 text-right">
              <Building2 className="w-4 h-4 text-slate-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800 max-w-[150px] truncate">
                  {business.name}
                </p>
                <p className="text-[10px] text-slate-700 font-mono" dir="ltr">
                  VAT: {business.vatNumber}
                </p>
              </div>
            </div>

            {/* User / Demo Status */}
            {isDemo ? (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-100 text-amber-900 font-medium px-2 py-1 rounded-md border border-amber-300">
                  حساب تجريبي
                </span>
                <button
                  onClick={onOpenAuth}
                  className="text-xs font-medium text-emerald-800 hover:text-emerald-900 underline"
                >
                  تسجيل حساب حقيقي
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-600 hover:text-red-700 rounded-lg hover:bg-slate-100 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
