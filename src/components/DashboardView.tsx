import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  FileCheck2,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  Eye,
  Edit3,
  Calendar,
  DollarSign,
  Building2,
  Users,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Invoice, Business } from '../types';

interface DashboardViewProps {
  invoices: Invoice[];
  business: Business;
  onNavigate: (tab: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  onEditDraft?: (invoice: Invoice) => void;
}

type TimeRange = 'today' | 'week' | 'month' | 'all';

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  business,
  onNavigate,
  onViewInvoice,
  onNewInvoice,
  onEditDraft,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  // Filter invoices based on selected time range
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    return invoices.filter((inv) => {
      const invDate = new Date(inv.issueDate || inv.createdAt);
      if (isNaN(invDate.getTime())) return true;

      if (timeRange === 'today') {
        return (
          invDate.getDate() === now.getDate() &&
          invDate.getMonth() === now.getMonth() &&
          invDate.getFullYear() === now.getFullYear()
        );
      }
      if (timeRange === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return invDate >= sevenDaysAgo;
      }
      if (timeRange === 'month') {
        return (
          invDate.getMonth() === now.getMonth() &&
          invDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [invoices, timeRange]);

  // Calculations
  const stats = useMemo(() => {
    // Only count issued or non-cancelled for total sales
    const validInvoices = filteredInvoices.filter(
      (i) => i.status === 'issued' || i.status === 'draft'
    );
    const issuedOnly = filteredInvoices.filter((i) => i.status === 'issued');

    const totalSales = issuedOnly.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    const subtotalSales = issuedOnly.reduce((sum, i) => sum + (i.taxableAmount || 0), 0);
    const totalVat = issuedOnly.reduce((sum, i) => sum + (i.vatTotal || 0), 0);
    const count = issuedOnly.length;
    const avgValue = count > 0 ? totalSales / count : 0;

    const draftInvoices = invoices.filter((i) => i.status === 'draft');
    
    // Invoices needing review: draft or standard invoice missing customer vatNumber
    const needingReview = invoices.filter((i) => {
      if (i.status === 'draft') return true;
      if (i.type === 'standard' && !i.customer?.vatNumber) return true;
      if (!i.customer?.name) return true;
      return false;
    });

    return {
      totalSales,
      subtotalSales,
      totalVat,
      count,
      avgValue,
      draftCount: draftInvoices.length,
      needingReviewCount: needingReview.length,
      needingReviewList: needingReview.slice(0, 3),
    };
  }, [filteredInvoices, invoices]);

  // Group invoices for chart (Last 7 intervals or days)
  const chartData = useMemo(() => {
    // Group by day of month or recent dates
    const dayMap: { [key: string]: { dateLabel: string; sales: number; vat: number; count: number } } = {};

    filteredInvoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;
      const d = new Date(inv.issueDate || inv.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dayMap[key]) {
        dayMap[key] = {
          dateLabel: key,
          sales: 0,
          vat: 0,
          count: 0,
        };
      }
      dayMap[key].sales += inv.grandTotal || 0;
      dayMap[key].vat += inv.vatTotal || 0;
      dayMap[key].count += 1;
    });

    const entries = Object.values(dayMap);
    if (entries.length === 0) {
      // Default placeholder intervals
      return [
        { dateLabel: 'السبت', sales: 1200, vat: 180, count: 2 },
        { dateLabel: 'الأحد', sales: 2400, vat: 360, count: 3 },
        { dateLabel: 'الإثنين', sales: 1800, vat: 270, count: 2 },
        { dateLabel: 'الثلاثاء', sales: 3200, vat: 480, count: 4 },
        { dateLabel: 'الأربعاء', sales: 2800, vat: 420, count: 3 },
        { dateLabel: 'الخميس', sales: 4100, vat: 615, count: 5 },
        { dateLabel: 'اليوم', sales: stats.totalSales || 2100, vat: stats.totalVat || 315, count: stats.count || 2 },
      ];
    }
    return entries.slice(-7);
  }, [filteredInvoices, stats]);

  const maxChartValue = Math.max(...chartData.map((d) => d.sales), 100);

  // Status Badge Helper
  const renderStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'issued':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            مصدرة
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            مسودة
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            ملغاة
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            مرتجعة (إشعار دائن)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Title and Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            لوحة مؤشرات الفوترة
          </h1>
          <p className="text-sm text-slate-700 mt-0.5">
            متابعة المبيعات، الفواتير الصادرة، وضريبة القيمة المضافة المحصلة لـ {business.name}
          </p>
        </div>

        {/* Time Range Filter Buttons */}
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'today'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'week'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'month'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              timeRange === 'all'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            كل الفترات
          </button>
        </div>
      </div>

      {/* Visual Attention Alert if any invoice needs review */}
      {stats.needingReviewCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                تنبيه: يوجد {stats.needingReviewCount} فاتورة بحاجة إلى مراجعة أو إكمال
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                فواتير غير مصدرة (مسودة) أو فواتير قياسية B2B ينقصها الرقم الضريبي للعميل.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('invoices')}
            className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            عرض الفواتير للمراجعة ←
          </button>
        </div>
      )}

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">إجمالي المبيعات (شامل الضريبة)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.totalSales.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-medium text-slate-700 mr-1.5">ر.س</span>
            </div>
            <p className="text-[11px] text-slate-700 mt-1">
              صافي المبيعات: {stats.subtotalSales.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
            </p>
          </div>
        </div>

        {/* Total VAT */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">ضريبة القيمة المضافة (15%)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.totalVat.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-medium text-slate-700 mr-1.5">ر.س</span>
            </div>
            <p className="text-[11px] text-slate-700 mt-1">
              مستحقة للإقرار الضريبي لدى ZATCA
            </p>
          </div>
        </div>

        {/* Invoices Count */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">عدد الفواتير الصادرة</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.count}
              <span className="text-xs font-medium text-slate-700 mr-1.5">فاتورة</span>
            </div>
            <p className="text-[11px] text-slate-700 mt-1">
              بالإضافة إلى {stats.draftCount} مسودة
            </p>
          </div>
        </div>

        {/* Average Invoice Value */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">متوسط قيمة الفاتورة</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.avgValue.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-medium text-slate-700 mr-1.5">ر.س</span>
            </div>
            <p className="text-[11px] text-slate-700 mt-1">
              معدل إنفاق العميل لكل عملية
            </p>
          </div>
        </div>
      </div>

      {/* Visual Chart & Quick Shortcuts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                حركة المبيعات والضريبة
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                توزيع الإيرادات وقيمة الضريبة المحصلة خلال الفترة
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-600"></span>
                <span className="text-slate-600">الإجمالي شامل الضريبة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-200"></span>
                <span className="text-slate-600">الضريبة 15%</span>
              </div>
            </div>
          </div>

          {/* Responsive Bar Chart Visualizer */}
          <div className="h-48 w-full flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-2 border-b border-slate-100">
            {chartData.map((bar, idx) => {
              const heightPercent = maxChartValue > 0 ? Math.round((bar.sales / maxChartValue) * 100) : 10;
              const vatHeightPercent = maxChartValue > 0 ? Math.round((bar.vat / maxChartValue) * 100) : 5;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md pointer-events-none whitespace-nowrap z-10">
                    <div>{bar.sales.toFixed(2)} ر.س</div>
                    <div className="text-slate-300">ضريبة: {bar.vat.toFixed(2)} ر.س</div>
                  </div>

                  {/* Stacked bar */}
                  <div className="w-full max-w-[40px] bg-slate-100 rounded-t-md overflow-hidden flex flex-col justify-end h-full relative">
                    <div
                      style={{ height: `${Math.max(12, heightPercent)}%` }}
                      className="w-full bg-emerald-600 group-hover:bg-emerald-700 transition-all rounded-t-md relative flex flex-col justify-start"
                    >
                      <div
                        style={{ height: `${Math.max(4, vatHeightPercent)}%` }}
                        className="w-full bg-emerald-300/80"
                      />
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-slate-700 mt-1">
                    {bar.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-700">
            <span>ملاحظة: البيانات تُحدّث تلقائياً مع إصدار أي فاتورة جديدة</span>
            <span className="font-semibold text-slate-700">تحديث فوري للفواتير</span>
          </div>
        </div>

        {/* Quick Actions & Shortcut Box (1 col) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              إجراءات سريعة
            </h3>
            <p className="text-xs text-slate-700 mb-4">
              اختصارات سريعة لإدارة المبيعات والعملاء
            </p>

            <div className="space-y-2.5">
              <button
                onClick={onNewInvoice}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200/80 transition-colors text-right font-semibold text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span>إصدار فاتورة إلكترونية جديدة</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
              </button>

              <button
                onClick={() => onNavigate('customers')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition-colors text-right font-medium text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>إدارة العملاء وقائمة المشتريين</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-600" />
              </button>

              <button
                onClick={() => onNavigate('products')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition-colors text-right font-medium text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <span>إضافة منتج أو خدمة جديدة</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-600" />
              </button>

              <button
                onClick={() => onNavigate('settings')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition-colors text-right font-medium text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span>بيانات المنشأة والرقم الضريبي</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-700 flex items-center justify-between">
            <span>الرقم التسلسلي التلقائي: مفعل</span>
            <span className="text-emerald-800 font-medium">آمن ضد التعارض</span>
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              آخر الفواتير الصادرة
            </h3>
            <p className="text-xs text-slate-700 mt-0.5">
              استعراض فوري للفواتير الأخيرة مع إمكانية الطباعة والمعاينة
            </p>
          </div>
          <button
            onClick={() => onNavigate('invoices')}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-900"
          >
            عرض جميع الفواتير ←
          </button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-700">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">لا توجد فواتير بعد</p>
            <button
              onClick={onNewInvoice}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              إصدار أول فاتورة الآن
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">الإجمالي (ر.س)</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 font-mono" dir="ltr">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-800">
                      <div className="font-medium">{inv.customer?.name}</div>
                      {inv.customer?.vatNumber && (
                        <div className="text-[10px] text-slate-600 font-mono" dir="ltr">
                          VAT: {inv.customer.vatNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('ar-SA') : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {inv.type === 'simplified' ? 'ضريبية مبسطة (B2C)' : 'ضريبية قياسية (B2B)'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {inv.grandTotal?.toFixed(2)} ر.س
                    </td>
                    <td className="py-3 px-4">
                      {renderStatusBadge(inv.status)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة</span>
                        </button>
                        {inv.status === 'draft' && onEditDraft && (
                          <button
                            onClick={() => onEditDraft(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            title="تعديل المسودة"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
