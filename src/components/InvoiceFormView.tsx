import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Receipt,
  UserPlus,
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode as QrIcon,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Invoice, InvoiceItem, Customer, Product, Business, InvoiceType } from '../types';
import { calculateItemAmounts, calculateInvoiceTotals, validateInvoice } from '../lib/invoiceService';
import { generateZatcaQRTLV } from '../lib/zatcaQr';

interface InvoiceFormViewProps {
  business: Business;
  customers: Customer[];
  products: Product[];
  onSaveInvoice: (invoiceData: Partial<Invoice>, asDraft: boolean) => Promise<void>;
  onCancel: () => void;
  onAddCustomer: (customer: Customer) => Promise<Customer>;
  initialInvoice?: Invoice | null;
}

export const InvoiceFormView: React.FC<InvoiceFormViewProps> = ({
  business,
  customers,
  products,
  onSaveInvoice,
  onCancel,
  onAddCustomer,
  initialInvoice,
}) => {
  const isEditing = Boolean(initialInvoice);

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    initialInvoice?.type || 'simplified'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialInvoice?.customer?.id || customers[0]?.id || ''
  );
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustVat, setNewCustVat] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  const [issueDate, setIssueDate] = useState<string>(
    initialInvoice?.issueDate
      ? initialInvoice.issueDate.split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [supplyDate, setSupplyDate] = useState<string>(
    initialInvoice?.supplyDate ||
      (initialInvoice?.issueDate
        ? initialInvoice.issueDate.split('T')[0]
        : new Date().toISOString().split('T')[0])
  );
  const [dueDate, setDueDate] = useState<string>(initialInvoice?.dueDate || '');
  const [notes, setNotes] = useState<string>(
    initialInvoice?.notes !== undefined
      ? initialInvoice.notes
      : 'شكراً لتعاملكم معنا. مستحق السداد خلال 14 يوماً.'
  );
  const [discount, setDiscount] = useState<number>(initialInvoice?.discount || 0);

  // Line items state initialized from draft if available
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initialInvoice?.items && initialInvoice.items.length > 0) {
      return initialInvoice.items.map((item) => ({ ...item }));
    }
    return [
      {
        id: 'item-init-1',
        name: products[0]?.name || 'استشارة تقنية وتطوير',
        nameEn: products[0]?.nameEn || 'Consulting & Development',
        productId: products[0]?.id,
        quantity: 1,
        unitPrice: products[0]?.price || 500,
        vatRate: products[0]?.vatRate || business.defaultVatRate || 15,
        subtotal: products[0]?.price || 500,
        vatAmount: ((products[0]?.price || 500) * (business.defaultVatRate || 15)) / 100,
        total: (products[0]?.price || 500) * (1 + (business.defaultVatRate || 15) / 100),
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Synchronous refs to immediately block rapid duplicate clicks
  const isSubmittingRef = useRef(false);
  const isSavingCustomerRef = useRef(false);
  const pendingCustIdRef = useRef<string>('');

  // Combined customers list including the initial draft's customer if not already present
  const availableCustomers = useMemo(() => {
    if (
      initialInvoice?.customer &&
      !customers.some((c) => c.id === initialInvoice.customer.id)
    ) {
      return [initialInvoice.customer, ...customers];
    }
    return customers;
  }, [customers, initialInvoice]);

  // Selected Customer Object
  const selectedCustomer = useMemo(() => {
    return (
      availableCustomers.find((c) => c.id === selectedCustomerId) ||
      availableCustomers[0] ||
      initialInvoice?.customer ||
      null
    );
  }, [availableCustomers, selectedCustomerId, initialInvoice]);

  // Recalculate totals
  const totals = useMemo(() => {
    return calculateInvoiceTotals(items, discount);
  }, [items, discount]);

  // Live QR Code generation for preview
  const liveQrCode = useMemo(() => {
    if (!business.name || !business.vatNumber || totals.grandTotal <= 0) return '';
    try {
      return generateZatcaQRTLV({
        sellerName: business.name,
        vatNumber: business.vatNumber,
        timestamp: `${issueDate}T${new Date().toISOString().split('T')[1]}`,
        totalWithVat: totals.grandTotal,
        vatTotal: totals.vatTotal,
      });
    } catch {
      return '';
    }
  }, [business, issueDate, totals]);

  // Handle item change
  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: any
  ) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        current.name = prod.name;
        current.nameEn = prod.nameEn || '';
        current.unitPrice = prod.price;
        current.vatRate = prod.vatRate;
      }
    }

    const { subtotal, vatAmount, total } = calculateItemAmounts(
      current.quantity,
      current.unitPrice,
      current.vatRate
    );

    current.subtotal = subtotal;
    current.vatAmount = vatAmount;
    current.total = total;

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      vatRate: business.defaultVatRate || 15,
      subtotal: 0,
      vatAmount: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorBanner('يجب أن تحتوي الفاتورة على بند واحد على الأقل');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleSave = async (asDraft: boolean) => {
    // Prevent duplicate submission from rapid concurrent clicks
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    setErrorBanner(null);

    if (!selectedCustomer) {
      setErrorBanner('يرجى اختيار عميل للفاتورة أو إضافة عميل جديد');
      return;
    }

    const invoicePayload: Partial<Invoice> = {
      ...(initialInvoice
        ? {
            id: initialInvoice.id,
            invoiceNumber: initialInvoice.invoiceNumber,
            sequenceNumber: initialInvoice.sequenceNumber,
            createdAt: initialInvoice.createdAt,
          }
        : {}),
      type: invoiceType,
      status: asDraft ? 'draft' : 'issued',
      customer: selectedCustomer,
      items: totals.items && totals.items.length > 0 ? totals.items : items,
      discount,
      issueDate: `${issueDate}T${
        initialInvoice?.issueDate?.split('T')[1] ||
        new Date().toISOString().split('T')[1]
      }`,
      supplyDate,
      dueDate: dueDate || undefined,
      notes,
    };

    const validation = validateInvoice(invoicePayload, business);
    if (!validation.isValid && !asDraft) {
      setErrorBanner(validation.errors.join(' • '));
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await onSaveInvoice(invoicePayload, asDraft);
    } catch (err: any) {
      setErrorBanner(err.message || 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCustomerRef.current || isSavingCustomer) {
      return;
    }
    if (!newCustName.trim()) return;

    isSavingCustomerRef.current = true;
    setIsSavingCustomer(true);

    try {
      const custId = pendingCustIdRef.current || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const created = await onAddCustomer({
        id: custId,
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        vatNumber: newCustVat.trim() || undefined,
        address: newCustAddress.trim() || 'المملكة العربية السعودية',
      });
      setSelectedCustomerId(created.id);
      setShowNewCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustVat('');
      setNewCustAddress('');
    } catch (err: any) {
      alert('فشل إضافة العميل: ' + err.message);
    } finally {
      isSavingCustomerRef.current = false;
      setIsSavingCustomer(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Cancel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            {isEditing ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">
                    تعديل مسودة الفاتورة:
                  </h1>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-sm" dir="ltr">
                    {initialInvoice?.invoiceNumber}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    مسودة
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-0.5">
                  تعديل العميل، البنود، الكميات، والأسعار مع حفظ التحديثات مباشرة على نفس المستند
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-900">
                  إصدار فاتورة إلكترونية جديدة
                </h1>
                <p className="text-xs text-slate-700">
                  توليد فوري لرقم الفاتورة ورمز الاستجابة السريع ZATCA QR
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg border border-slate-300 transition-colors inline-flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isEditing ? 'جاري حفظ التعديلات...' : 'جاري الحفظ...'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isEditing ? 'حفظ التعديلات' : 'حفظ كمسودة'}</span>
              </>
            )}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-emerald-700/60 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isEditing ? 'جاري الإصدار...' : 'جاري الحفظ والإصدار...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>إصدار الفاتورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-medium">{errorBanner}</span>
        </div>
      )}

      {/* Main Grid: Form Left (2 cols), Live Preview Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Container */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Invoice Type & Dates */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-700" />
              <span>نوع الفاتورة والتواريخ</span>
            </h3>

            {/* Type selector toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نوع الفاتورة الإلكترونية
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInvoiceType('simplified')}
                  className={`p-3 rounded-xl border text-right transition-all ${
                    invoiceType === 'simplified'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">
                    فاتورة ضريبية مبسطة (B2C)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    للأفراد والمستهلكين النهائيين (الأكثر شيوعاً للمحلات)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceType('standard')}
                  className={`p-3 rounded-xl border text-right transition-all ${
                    invoiceType === 'standard'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">
                    فاتورة ضريبية قياسية (B2B)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    للشركات والمؤسسات (تتطلب الرقم الضريبي للعميل)
                  </div>
                </button>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ ووقت الفاتورة *
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ التوريد
                </label>
                <input
                  type="date"
                  value={supplyDate}
                  onChange={(e) => setSupplyDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ الاستحقاق
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Customer Selection */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>بيانات العميل (المشتري)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة عميل جديد</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اختر العميل من القائمة *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
                >
                  {availableCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.vatNumber ? `(ضريبي: ${c.vatNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="font-semibold text-slate-900">{selectedCustomer.name}</div>
                  <div className="text-slate-600">هاتف: {selectedCustomer.phone || '-'}</div>
                  {selectedCustomer.vatNumber ? (
                    <div className="text-emerald-700 font-mono" dir="ltr">
                      VAT: {selectedCustomer.vatNumber}
                    </div>
                  ) : invoiceType === 'standard' ? (
                    <div className="text-rose-600 font-semibold text-[11px]">
                      ⚠️ تنبيه: العميل لا يملك رقماً ضريبياً مسجلاً (مطلوب للفاتورة القياسية B2B)
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Line Items Table */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  بنود الفاتورة والمنتجات
                </h3>
                <p className="text-[11px] text-slate-600">
                  الأسعار غير شاملة الضريبة، ويتم احتساب 15% تلقائياً
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند</span>
              </button>
            </div>

            {/* Items table */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      البند #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors disabled:opacity-30"
                      title="حذف البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Product Quick Select & Custom Name */}
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        اسم السلعة / الخدمة *
                      </label>
                      <div className="space-y-1.5">
                        <select
                          value={item.productId || ''}
                          onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">-- اختيار من كتالوج المنتجات --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.price} ر.س)
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="أو اكتب وصف البند يدوياً..."
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
                        />
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        السعر (ر.س) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white font-mono text-center"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        الكمية *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white font-mono text-center font-bold"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="sm:col-span-2 text-left sm:text-right bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                      <span className="text-[10px] text-slate-700 block">الإجمالي بالضريبة</span>
                      <span className="font-bold text-xs text-slate-900 font-mono">
                        {(totals.items[idx]?.total ?? item.total).toFixed(2)} ر.س
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono">
                        (ضريبة: {(totals.items[idx]?.vatAmount ?? item.vatAmount).toFixed(2)})
                      </span>
                      {totals.items[idx]?.discount && totals.items[idx].discount! > 0 ? (
                        <span className="text-[9px] text-rose-600 font-mono">
                          خصم: -{totals.items[idx].discount!.toFixed(2)} ر.س
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  خصم تجاري إجمالي (ر.س)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ملاحظات الفاتورة والشروط
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  placeholder="شروط السداد أو التحويل البنكي..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Calculations & Real-time ZATCA QR Preview */}
        <div className="space-y-6">
          {/* Financial Calculation Box */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              ملخص المبالغ والضريبة
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">المجموع قبل الضريبة:</span>
                <span className="font-semibold font-mono text-slate-900">
                  {totals.subtotal.toFixed(2)} ر.س
                </span>
              </div>

              {totals.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                  <span>الخصم:</span>
                  <span className="font-semibold font-mono">
                    -{totals.discount.toFixed(2)} ر.س
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">المبلغ الخاضع للضريبة:</span>
                <span className="font-semibold font-mono text-slate-900">
                  {totals.taxableAmount.toFixed(2)} ر.س
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ضريبة القيمة المضافة (15%):</span>
                <span className="font-bold font-mono text-emerald-700">
                  {totals.vatTotal.toFixed(2)} ر.س
                </span>
              </div>

              <div className="flex justify-between py-2 pt-3 text-sm font-extrabold bg-slate-900 text-white -mx-5 -mb-5 px-5 rounded-b-xl">
                <span>الإجمالي المستحق:</span>
                <span className="font-mono text-base" dir="ltr">
                  {totals.grandTotal.toFixed(2)} SAR
                </span>
              </div>
            </div>
          </div>

          {/* Live ZATCA QR Code Preview */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>معاينة رمز ZATCA QR لحظياً</span>
            </div>

            {liveQrCode ? (
              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                <QRCodeSVG value={liveQrCode} size={130} level="M" />
              </div>
            ) : (
              <div className="w-32 h-32 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-xs text-slate-400">
                أدخل البنود للمعاينة
              </div>
            )}

            <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
              رمز الاستجابة السريع يحتوي على ترميز TLV Base64 وفق صيغة ZATCA.
            </p>

            <div className="w-full pt-2 border-t border-slate-100 text-[11px] text-slate-600 text-right space-y-1">
              <div>• البائع: <span className="font-semibold text-slate-900">{business.name}</span></div>
              <div>• الرقم الضريبي: <span className="font-mono text-slate-900">{business.vatNumber}</span></div>
              <div>• الإجمالي: <span className="font-mono font-bold text-emerald-700">{totals.grandTotal.toFixed(2)} ر.س</span></div>
            </div>
          </div>

          {/* Action Buttons in right bar */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-600/60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEditing ? 'جاري الإصدار...' : 'جاري الحفظ والإصدار...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إصدار الفاتورة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEditing ? 'جاري حفظ التعديلات...' : 'جاري الحفظ...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'حفظ التعديلات' : 'حفظ كمسودة أولية'}</span>
                </>
              )}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="w-full py-2 px-4 text-slate-600 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-50 text-xs font-semibold rounded-xl transition-colors text-center"
              >
                إلغاء والعودة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Quick Adding Customer */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              إضافة عميل جديد سريعاً
            </h3>
            <form onSubmit={handleCreateCustomerSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  اسم العميل / الشركة *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: شركة الحلول المتقدمة"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الرقم الضريبي للعميل (15 رقم للشركات B2B)
                </label>
                <input
                  type="text"
                  value={newCustVat}
                  onChange={(e) => setNewCustVat(e.target.value)}
                  placeholder="300XXXXXXXXXXXX"
                  maxLength={15}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  العنوان / المدينة
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="الرياض، حي الملز"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingCustomer}
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 disabled:cursor-not-allowed text-white font-bold transition-all shadow-xs"
                >
                  {isSavingCustomer ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ واختيار العميل</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
