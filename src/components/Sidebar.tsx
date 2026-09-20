import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  FilePlus,
  Users,
  Package,
  Settings,
  FlaskConical,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  invoicesNeedingReviewCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  invoicesNeedingReviewCount = 0,
}) => {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'لوحة التحكم',
      icon: LayoutDashboard,
    },
    {
      id: 'invoices',
      label: 'إدارة الفواتير',
      icon: Receipt,
      badge: invoicesNeedingReviewCount > 0 ? invoicesNeedingReviewCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'new-invoice',
      label: 'إصدار فاتورة جديدة',
      icon: FilePlus,
      highlight: true,
    },
    {
      id: 'customers',
      label: 'العملاء',
      icon: Users,
    },
    {
      id: 'products',
      label: 'المنتجات والخدمات',
      icon: Package,
    },
    {
      id: 'settings',
      label: 'بيانات المنشأة والإعدادات',
      icon: Settings,
    },
    {
      id: 'tests',
      label: 'فحص النظام والاختبارات',
      icon: FlaskConical,
      badge: 'ZATCA',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 shrink-0 hidden md:flex flex-col justify-between p-4 border-l border-slate-800 no-print">
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            القائمة الرئيسية
          </p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ZATCA Info Card */}
        <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ميزات الفوترة الإلكترونية</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            يدعم النظام توليد رموز QR بصيغة TLV Base64 وفق متطلبات الفوترة الإلكترونية.
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>ترميز TLV: مُفعل</span>
            <span className="text-amber-300">الربط المباشر: قريباً</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-[11px] text-slate-400 px-3 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span>الإصدار 1.0.0</span>
        <span>السعودية 🇸🇦</span>
      </div>
    </aside>
  );
};
