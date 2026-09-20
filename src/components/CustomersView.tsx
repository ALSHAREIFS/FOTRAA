import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Customer } from '../types';
import { validateSaudiVatNumber } from '../lib/zatcaQr';

interface CustomersViewProps {
  customers: Customer[];
  onSaveCustomer: (customer: Customer) => Promise<Customer>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onSaveCustomer,
  onDeleteCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Synchronous refs to prevent rapid-click duplicate execution
  const isSavingRef = useRef(false);
  const pendingIdRef = useRef<string>('');
  const deletingRef = useRef<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formVat, setFormVat] = useState('');
  const [formAddress, setFormAddress] = useState('');

  const filtered = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.vatNumber && c.vatNumber.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  const openNewCustomerModal = () => {
    pendingIdRef.current = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEditingCustomer(null);
    setFormName('');
    setFormNameEn('');
    setFormPhone('');
    setFormEmail('');
    setFormVat('');
    setFormAddress('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditCustomerModal = (customer: Customer) => {
    pendingIdRef.current = customer.id;
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormNameEn(customer.nameEn || '');
    setFormPhone(customer.phone || '');
    setFormEmail(customer.email || '');
    setFormVat(customer.vatNumber || '');
    setFormAddress(customer.address || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submission from rapid concurrent clicks
    if (isSavingRef.current || isSaving) {
      return;
    }

    setErrorMsg(null);

    if (!formName.trim()) {
      setErrorMsg('اسم العميل أو المنشأة مطلوب');
      return;
    }

    if (formVat.trim()) {
      const vatCheck = validateSaudiVatNumber(formVat.trim());
      if (!vatCheck.isValid) {
        setErrorMsg(vatCheck.error || 'الرقم الضريبي غير صالح');
        return;
      }
    }

    isSavingRef.current = true;
    setIsSaving(true);

    const customerToSave: Customer = {
      id: editingCustomer ? editingCustomer.id : (pendingIdRef.current || `cust-${Date.now()}`),
      name: formName.trim(),
      nameEn: formNameEn.trim() || undefined,
      phone: formPhone.trim(),
      email: formEmail.trim() || undefined,
      vatNumber: formVat.trim() || undefined,
      address: formAddress.trim(),
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
    };

    try {
      await onSaveCustomer(customerToSave);
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ بيانات العميل');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (deletingRef.current || deletingId) return;
    if (confirm(`هل أنت متأكد من رغبتك في حذف العميل "${name}"؟`)) {
      deletingRef.current = id;
      setDeletingId(id);
      try {
        await onDeleteCustomer(id);
      } catch (err: any) {
        alert('حدث خطأ أثناء الحذف: ' + err.message);
      } finally {
        deletingRef.current = null;
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            دليل وإدارة العملاء
          </h1>
          <p className="text-xs text-slate-700 mt-0.5">
            إدارة بيانات المشترين والأرقام الضريبية للفواتير المبسطة والقياسية B2B
          </p>
        </div>

        <button
          onClick={openNewCustomerModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث بالاسم، الجوال، أو الرقم الضريبي..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pr-9 pl-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          />
        </div>
        <div className="text-xs text-slate-700 font-medium">
          إجمالي المسجلين: {customers.length} عميل
        </div>
      </div>

      {/* Customers Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-700 space-y-2">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">لا يوجد عملاء مطابقين</p>
          <p className="text-xs text-slate-700">أضف عملاء جدد لحفظهم وإدراجهم سريعاً في الفواتير</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{customer.name}</h3>
                    {customer.nameEn && (
                      <p className="text-[11px] text-slate-700" dir="ltr">
                        {customer.nameEn}
                      </p>
                    )}
                  </div>
                  {customer.vatNumber ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      منشأة B2B
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-800">
                      فرد B2C
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-3">
                  {customer.vatNumber && (
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-slate-800" dir="ltr">
                        VAT: {customer.vatNumber}
                      </span>
                    </div>
                  )}

                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr">{customer.phone}</span>
                    </div>
                  )}

                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}

                  {customer.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => openEditCustomerModal(customer)}
                  className="p-1.5 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={() => handleDelete(customer.id, customer.name)}
                  className="p-1.5 text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-xs font-medium inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add/Edit Customer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
            </h3>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  اسم العميل أو المنشأة *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: شركة الحلول الرقمية"
                  className="w-full p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الاسم بالإنجليزية (اختياري)
                </label>
                <input
                  type="text"
                  value={formNameEn}
                  onChange={(e) => setFormNameEn(e.target.value)}
                  placeholder="Digital Solutions Ltd"
                  className="w-full p-2 rounded-lg border border-slate-300"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  الرقم الضريبي (15 رقم يبدأ وينتهي بـ 3 للشركات B2B)
                </label>
                <input
                  type="text"
                  value={formVat}
                  onChange={(e) => setFormVat(e.target.value)}
                  placeholder="300123456700003"
                  maxLength={15}
                  className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="billing@example.com"
                    className="w-full p-2 rounded-lg border border-slate-300"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  العنوان / المدينة
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="الرياض، حي السليمانية"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-700/60 disabled:cursor-not-allowed text-white font-bold transition-all shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingCustomer ? 'حفظ التعديلات' : 'حفظ العميل'}</span>
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
