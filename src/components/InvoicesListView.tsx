import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit3,
  Printer,
  Download,
  Receipt,
  AlertTriangle,
  RotateCcw,
  Ban,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Invoice, Business, InvoiceStatus, InvoiceType } from '../types';

interface InvoicesListViewProps {
  invoices: Invoice[];
  business: Business;
  onViewInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  onUpdateStatus: (invoiceId: string, newStatus: InvoiceStatus) => Promise<void>;
  onCreateCreditNote: (originalInvoice: Invoice) => void;
  onEditDraft?: (invoice: Invoice) => void;
}

export const InvoicesListView: React.FC<InvoicesListViewProps> = ({
  invoices,
  business,
  onViewInvoice,
  onNewInvoice,
  onUpdateStatus,
  onCreateCreditNote,
  onEditDraft,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const updatingStatusRef = useRef<string | null>(null);

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    if (updatingStatusRef.current || updatingStatusId) return;
    updatingStatusRef.current = invoiceId;
    setUpdatingStatusId(invoiceId);
    try {
      await onUpdateStatus(invoiceId, newStatus);
    } finally {
      updatingStatusRef.current = null;
      setUpdatingStatusId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer.vatNumber && inv.customer.vatNumber.includes(searchTerm));

      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchesType = typeFilter === 'all' || inv.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [invoices, searchTerm, statusFilter, typeFilter]);

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;

    const headers = [
      'رقم الفاتورة',
      'التاريخ',
      'نوع الفاتورة',
      'اسم العميل',
      'الرقم الضريبي للعميل',
      'المجموع قبل الضريبة',
      'الخصم',
      'ضريبة القيمة المضافة 15%',
      'الإجمالي شامل الضريبة',
      'الحالة',
    ];

    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('ar-SA') : '',
      inv.type === 'simplified' ? 'فاتورة مبسطة' : 'فاتورة ضريبية قياسية',
      `"${inv.customer.name}"`,
      inv.customer.vatNumber || '',
      inv.subtotal.toFixed(2),
      inv.discount.toFixed(2),
      inv.vatTotal.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.status === 'issued' ? 'مصدرة' : inv.status === 'draft' ? 'مسودة' : 'ملغاة',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `فاتورة-${business.invoicePrefix}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            سجل وإدارة الفواتير
          </h1>
          <p className="text-xs text-slate-700 mt-0.5">
            عرض، طباعة، وإدارة الفواتير الإلكترونية بنظام ZATCA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>تصدير CSV</span>
          </button>

          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إصدار فاتورة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pr-9 pl-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-700 font-medium">الحالة:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
            >
              <option value="all">الكل</option>
              <option value="issued">مصدرة</option>
              <option value="draft">مسودة</option>
              <option value="cancelled">ملغاة</option>
              <option value="refunded">مرتجعة</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-700 font-medium">النوع:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
            >
              <option value="all">كل الأنواع</option>
              <option value="simplified">مبسطة (B2C)</option>
              <option value="standard">قياسية (B2B)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-700 space-y-2">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              لا توجد فواتير تطابق معايير البحث
            </p>
            <p className="text-xs text-slate-700">
              جرّب تغيير كلمات البحث أو الفلاتر المحددة
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">تاريخ الإصدار</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">المجموع قبل الضريبة</th>
                  <th className="py-3 px-4">الضريبة 15%</th>
                  <th className="py-3 px-4 font-bold text-slate-900">الإجمالي</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900" dir="ltr">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{inv.customer.name}</div>
                      {inv.customer.vatNumber && (
                        <div className="text-[10px] text-slate-600 font-mono" dir="ltr">
                          VAT: {inv.customer.vatNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">
                      {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('ar-SA') : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {inv.type === 'simplified' ? (
                        <span className="text-slate-800">مبسطة (B2C)</span>
                      ) : (
                        <span className="text-blue-900 font-medium">قياسية (B2B)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-mono">
                      {inv.subtotal.toFixed(2)} ر.س
                    </td>
                    <td className="py-3.5 px-4 text-emerald-800 font-mono font-medium">
                      {inv.vatTotal.toFixed(2)} ر.س
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-950 font-mono">
                      {inv.grandTotal.toFixed(2)} ر.س
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {inv.status === 'issued' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          مصدرة
                        </span>
                      )}
                      {inv.status === 'draft' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          مسودة
                        </span>
                      )}
                      {inv.status === 'cancelled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                          ملغاة
                        </span>
                      )}
                      {inv.status === 'refunded' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          مرتجعة
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                          title="عرض وطباعة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>

                        {updatingStatusId === inv.id ? (
                          <span className="p-1 text-slate-500 inline-flex items-center gap-1 text-[11px]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            <span>جاري التحديث...</span>
                          </span>
                        ) : (
                          <>
                            {inv.status === 'draft' && (
                              <>
                                {onEditDraft && (
                                  <button
                                    onClick={() => onEditDraft(inv)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                    title="تعديل المسودة"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>تعديل</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleStatusChange(inv.id, 'issued')}
                                  className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                  title="إصدار الفاتورة"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {inv.status === 'issued' && (
                              <>
                                <button
                                  onClick={() => onCreateCreditNote(inv)}
                                  className="p-1 text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                  title="إنشاء إشعار دائن (مرتجع)"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(inv.id, 'cancelled')}
                                  className="p-1 text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                                  title="إلغاء الفاتورة"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
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
