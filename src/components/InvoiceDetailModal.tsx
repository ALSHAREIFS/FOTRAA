import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  QrCode as QrIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
  Edit3,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Invoice, Business } from '../types';
import { decodeZatcaQRTLV } from '../lib/zatcaQr';
import { calculateInvoiceTotals } from '../lib/invoiceService';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  business: Business;
  onClose: () => void;
  onUpdateStatus?: (status: Invoice['status']) => Promise<void> | void;
  onEditDraft?: (invoice: Invoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  business,
  onClose,
  onUpdateStatus,
  onEditDraft,
}) => {
  const [showQrInspector, setShowQrInspector] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const isUpdatingRef = useRef(false);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!invoice) return null;

  const handleUpdateStatusClick = async (status: Invoice['status']) => {
    if (!onUpdateStatus || isUpdatingRef.current || isUpdating) return;
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await onUpdateStatus(status);
    } finally {
      isUpdatingRef.current = false;
      setIsUpdating(false);
    }
  };

  const decodedQr = invoice.qrCode ? decodeZatcaQRTLV(invoice.qrCode) : null;

  // Compute reconciled lines to guarantee table lines match invoice summary exactly
  const computedTotals = useMemo(() => {
    if (!invoice) return null;
    return calculateInvoiceTotals(invoice.items || [], invoice.discount || 0);
  }, [invoice]);

  const displayItems =
    computedTotals?.items && computedTotals.items.length > 0
      ? computedTotals.items
      : invoice.items || [];

  const handlePrint = () => {
    window.print();
  };

  const getInvoiceTitle = () => {
    switch (invoice.type) {
      case 'standard':
        return {
          ar: 'فاتورة ضريبية',
          en: 'TAX INVOICE',
        };
      case 'credit_note':
        return {
          ar: 'إشعار دائن (مرتجع)',
          en: 'CREDIT NOTE',
        };
      case 'debit_note':
        return {
          ar: 'إشعار مدين',
          en: 'DEBIT NOTE',
        };
      case 'simplified':
      default:
        return {
          ar: 'فاتورة ضريبية مبسطة',
          en: 'SIMPLIFIED TAX INVOICE',
        };
    }
  };

  const title = getInvoiceTitle();

  return (
    <div
      id="invoice-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible"
    >
      <div
        id="invoice-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200 relative print:border-none print:shadow-none print:max-w-none print:max-h-none print:my-0 print:overflow-visible"
      >
        
        {/* Modal Controls Bar (Sticky at top, always visible even when content is long, hidden during print) */}
        <div className="sticky top-0 z-30 shrink-0 bg-slate-900 text-white p-3.5 sm:p-4 px-4 sm:px-6 flex items-center justify-between no-print border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="font-bold text-sm sm:text-base">معاينة الفاتورة:</span>
            <span className="font-mono text-emerald-400 font-semibold text-xs sm:text-sm" dir="ltr">
              {invoice.invoiceNumber}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              invoice.status === 'issued'
                ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                : invoice.status === 'draft'
                ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                : 'bg-rose-900/80 text-rose-200 border border-rose-700'
            }`}>
              {invoice.status === 'issued' ? 'مصدرة' : invoice.status === 'draft' ? 'مسودة' : 'ملغاة'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {invoice.status === 'draft' && (
              <>
                {onEditDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditDraft(invoice);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                    title="تعديل بيانات المسودة"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تعديل المسودة</span>
                  </button>
                )}

                {onUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatusClick('issued')}
                    disabled={isUpdating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الإصدار...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">إصدار الفاتورة</span>
                        <span className="sm:hidden">إصدار</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">طباعة / حفظ PDF</span>
              <span className="sm:hidden">طباعة</span>
            </button>

            {/* Clearly visible Close (X) button at top corner - remains visible always */}
            <button
              id="invoice-modal-close-button"
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-600 active:bg-rose-700 text-slate-200 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer shadow-xs"
              title="إغلاق النافذة (Esc)"
              aria-label="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
              <span className="text-xs font-bold">إغلاق</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Body */}
        <div className="printable-invoice-container overflow-y-auto flex-1 p-6 sm:p-10 bg-white text-slate-900 text-sm print:overflow-visible print:p-0">
          
          {/* Header section: Seller Information & Official ZATCA QR Code */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-6">
            <div className="space-y-1.5 max-w-md">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                  {business.name}
                </h1>
              </div>
              <p className="text-xs font-medium text-slate-700" dir="ltr">
                {business.nameEn || 'Commercial Enterprise'}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs text-slate-800">
                <div>
                  <span className="font-bold text-slate-950">الرقم الضريبي (VAT):</span>
                  <p className="font-mono text-slate-950 font-bold tracking-wider" dir="ltr">
                    {business.vatNumber}
                  </p>
                </div>
                {business.crNumber && (
                  <div>
                    <span className="font-bold text-slate-950">السجل التجاري (C.R):</span>
                    <p className="font-mono text-slate-950 font-medium" dir="ltr">
                      {business.crNumber}
                    </p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <span className="font-bold text-slate-950">العنوان:</span>{' '}
                  <span>{business.address}, {business.city}</span>
                </div>
                {business.phone && (
                  <div>
                    <span className="font-bold text-slate-950">الهاتف:</span>{' '}
                    <span dir="ltr">{business.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Official QR Code & Invoice Title */}
            <div className="flex flex-col items-center sm:items-end self-center sm:self-start text-center sm:text-left">
              <div className="bg-slate-900 text-white px-4 py-1.5 rounded-md mb-3 text-center w-full sm:w-auto shadow-xs">
                <div className="text-base font-extrabold tracking-wide">{title.ar}</div>
                <div className="text-[10px] tracking-widest text-slate-300 font-mono">{title.en}</div>
              </div>

              {invoice.qrCode ? (
                <div className="p-2 bg-white border border-slate-300 rounded-lg shadow-xs flex flex-col items-center">
                  <QRCodeSVG
                    value={invoice.qrCode}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                  <span className="text-[9px] text-slate-700 mt-1 font-mono">
                    ZATCA QR TLV
                  </span>
                </div>
              ) : (
                <div className="w-24 h-24 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-600">
                  رمز QR لم يصدر
                </div>
              )}
            </div>
          </div>

          {/* Metadata Grid (Invoice details and Customer details) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-200">
            {/* Invoice Meta */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="text-xs font-bold text-slate-900 pb-1 border-b border-slate-200 flex justify-between">
                <span>بيانات الفاتورة</span>
                <span className="text-slate-600 font-normal">Invoice Details</span>
              </div>
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-slate-700">رقم الفاتورة / Invoice No:</span>
                <span className="font-bold font-mono text-slate-900" dir="ltr">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-slate-700">تاريخ الإصدار / Issue Date:</span>
                <span className="font-medium text-slate-900" dir="ltr">
                  {new Date(invoice.issueDate).toLocaleString('ar-SA')}
                </span>
              </div>
              {invoice.supplyDate && (
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-700">تاريخ التوريد / Supply Date:</span>
                  <span className="font-medium text-slate-900" dir="ltr">{invoice.supplyDate}</span>
                </div>
              )}
              {invoice.dueDate && (
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-700">تاريخ الاستحقاق / Due Date:</span>
                  <span className="font-medium text-slate-900" dir="ltr">{invoice.dueDate}</span>
                </div>
              )}
            </div>

            {/* Customer Meta */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="text-xs font-bold text-slate-900 pb-1 border-b border-slate-200 flex justify-between">
                <span>بيانات العميل (المشتري)</span>
                <span className="text-slate-600 font-normal">Buyer Details</span>
              </div>
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-slate-700">الاسم / Name:</span>
                <span className="font-bold text-slate-900">{invoice.customer.name}</span>
              </div>
              {invoice.customer.vatNumber && (
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-700">الرقم الضريبي / Buyer VAT:</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {invoice.customer.vatNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-slate-700">الهاتف / Phone:</span>
                <span className="font-medium text-slate-900" dir="ltr">{invoice.customer.phone || '-'}</span>
              </div>
              {invoice.customer.address && (
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-700">العنوان / Address:</span>
                  <span className="font-medium text-slate-900">{invoice.customer.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center w-8">#</th>
                    <th className="py-2.5 px-3 border-l border-slate-800">
                      <div>الوصف والسلعة</div>
                      <div className="text-[10px] text-slate-300 font-normal">Item Description</div>
                    </th>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center">
                      <div>سعر الوحدة</div>
                      <div className="text-[10px] text-slate-300 font-normal">Unit Price (SAR)</div>
                    </th>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center">
                      <div>الكمية</div>
                      <div className="text-[10px] text-slate-300 font-normal">Quantity</div>
                    </th>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center">
                      <div>المجموع الخاضع</div>
                      <div className="text-[10px] text-slate-300 font-normal">Taxable (SAR)</div>
                    </th>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center">
                      <div>نسبة الضريبة</div>
                      <div className="text-[10px] text-slate-300 font-normal">VAT Rate</div>
                    </th>
                    <th className="py-2.5 px-3 border-l border-slate-800 text-center">
                      <div>مبلغ الضريبة</div>
                      <div className="text-[10px] text-slate-300 font-normal">VAT (SAR)</div>
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      <div>الإجمالي شامل الضريبة</div>
                      <div className="text-[10px] text-slate-300 font-normal">Total with VAT (SAR)</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayItems.map((item, idx) => {
                    const lineDiscount = item.discount || 0;
                    const lineTaxable =
                      item.taxableAmount !== undefined
                        ? item.taxableAmount
                        : item.subtotal - lineDiscount;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 font-medium text-slate-900">
                          <div>{item.name}</div>
                          {item.nameEn && (
                            <div className="text-[11px] text-slate-600 font-normal" dir="ltr">
                              {item.nameEn}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center font-mono">
                          {item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center font-bold font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center font-mono">
                          <div>{lineTaxable.toFixed(2)}</div>
                          {lineDiscount > 0 && (
                            <div className="text-[10px] text-rose-600 font-mono">
                              خصم: -{lineDiscount.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center font-semibold text-emerald-800 font-mono">
                          {item.vatRate}%
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 text-center font-mono">
                          {item.vatAmount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-950 font-mono">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary Box & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Notes & Terms */}
            <div className="space-y-3">
              {invoice.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900 block mb-1">
                    الشروط والملاحظات:
                  </span>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                    {invoice.notes}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-slate-600 space-y-0.5">
                <p>• هذه الفاتورة صادرة إلكترونياً وتتضمن رمز الاستجابة السريع (QR Code) وفق متطلبات الفوترة الإلكترونية.</p>
                <p>• جميع المبالغ المذكورة بالريال السعودي (SAR).</p>
              </div>
            </div>

            {/* Financial Summary Calculation Table */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-700">إجمالي المبلغ الخاضع للضريبة (غير شامل الضريبة):</span>
                <span className="font-bold font-mono text-slate-900">{invoice.subtotal.toFixed(2)} ر.س</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200 text-rose-600">
                  <span>الخصم التجاري (Discount):</span>
                  <span className="font-bold font-mono">-{invoice.discount.toFixed(2)} ر.س</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-700">المبلغ الخاضع للضريبة بعد الخصم:</span>
                <span className="font-bold font-mono text-slate-900">{invoice.taxableAmount.toFixed(2)} ر.س</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-700">إجمالي ضريبة القيمة المضافة (15% VAT):</span>
                <span className="font-bold font-mono text-emerald-700">{invoice.vatTotal.toFixed(2)} ر.س</span>
              </div>

              <div className="flex justify-between py-2 pt-3 text-sm font-extrabold bg-slate-900 text-white -mx-4 -mb-4 px-4 rounded-b-xl">
                <span>إجمالي المبلغ المستحق (Grand Total):</span>
                <span className="font-mono text-base tracking-wide" dir="ltr">
                  {invoice.grandTotal.toFixed(2)} SAR
                </span>
              </div>
            </div>
          </div>

          {/* Interactive QR TLV Inspector (Visible on screen, hidden on print) */}
          <div className="mt-8 no-print pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowQrInspector(!showQrInspector)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors"
            >
              <QrIcon className="w-4 h-4 text-emerald-600" />
              <span>فحص محتويات رمز الاستجابة السريع ZATCA QR (TLV Base64 Inspector)</span>
              {showQrInspector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showQrInspector && decodedQr && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs pb-1 border-b border-slate-200">
                  <ShieldCheck className="w-4 h-4" />
                  <span>فحص محتويات التشفير ومطابقة الحقول (ZATCA QR Fields)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="font-bold text-slate-900">وسم 1 (اسم البائع / Seller):</span>{' '}
                    <span>{decodedQr.sellerName}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">وسم 2 (الرقم الضريبي / VAT):</span>{' '}
                    <span className="font-mono font-bold" dir="ltr">{decodedQr.vatNumber}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">وسم 3 (تاريخ ووقت الإصدار / Timestamp):</span>{' '}
                    <span className="font-mono" dir="ltr">{decodedQr.timestamp}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">وسم 4 (إجمالي الفاتورة مع الضريبة):</span>{' '}
                    <span className="font-mono font-bold">{decodedQr.totalWithVat.toFixed(2)} ر.س</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">وسم 5 (إجمالي ضريبة القيمة المضافة):</span>{' '}
                    <span className="font-mono font-bold">{decodedQr.vatTotal.toFixed(2)} ر.س</span>
                  </div>
                  <div className="sm:col-span-2 text-[11px] text-slate-500 font-mono break-all pt-1">
                    <span className="font-bold text-slate-700">Base64 TLV:</span> {invoice.qrCode}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
