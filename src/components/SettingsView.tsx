import React, { useState, useRef } from 'react';
import {
  Building2,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Percent,
  Hash,
  MapPin,
  Phone,
  Mail,
  Lock,
  ExternalLink,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Business } from '../types';
import { validateSaudiVatNumber } from '../lib/zatcaQr';

interface SettingsViewProps {
  business: Business;
  onSaveBusiness: (business: Business) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  business,
  onSaveBusiness,
}) => {
  const [name, setName] = useState(business.name);
  const [nameEn, setNameEn] = useState(business.nameEn || '');
  const [vatNumber, setVatNumber] = useState(business.vatNumber);
  const [crNumber, setCrNumber] = useState(business.crNumber || '');
  const [address, setAddress] = useState(business.address || '');
  const [city, setCity] = useState(business.city || 'الرياض');
  const [phone, setPhone] = useState(business.phone || '');
  const [email, setEmail] = useState(business.email || '');
  const [defaultVatRate, setDefaultVatRate] = useState(business.defaultVatRate || 15);
  const [invoicePrefix, setInvoicePrefix] = useState(business.invoicePrefix || 'INV-');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const isSavingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRef.current || isSaving) {
      return;
    }

    setFeedback(null);

    // Validation
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'اسم المنشأة بالعربية إلزامي' });
      return;
    }

    const vatCheck = validateSaudiVatNumber(vatNumber);
    if (!vatCheck.isValid) {
      setFeedback({ type: 'error', message: vatCheck.error || 'الرقم الضريبي غير صحيح' });
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    const updated: Business = {
      ...business,
      name: name.trim(),
      nameEn: nameEn.trim(),
      vatNumber: vatNumber.trim(),
      crNumber: crNumber.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: phone.trim(),
      email: email.trim(),
      defaultVatRate: Number(defaultVatRate) || 15,
      invoicePrefix: invoicePrefix.trim() || 'INV-',
    };

    try {
      await onSaveBusiness(updated);
      setFeedback({ type: 'success', message: 'تم حفظ وتحديث بيانات المنشأة بنجاح' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'فشل حفظ التعديلات' });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          إعدادات وبيانات المنشأة
        </h1>
        <p className="text-xs text-slate-700 mt-0.5">
          إدارة بيانات المنشأة والتفضيلات التشغيلية للفواتير الإلكترونية
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span className="font-semibold">{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Official ZATCA Business Identity */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>البيانات الضريبية والتجارية</span>
            </h3>
            <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              تظهر في رمز QR والمطبوعات
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                اسم المنشأة أو المؤسسة (بالعربية) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مؤسسة الأفق للتجارة"
                className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                اسم المنشأة (بالإنجليزية)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Al-Ofuq Trading Est."
                className="w-full p-2.5 rounded-lg border border-slate-300"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                الرقم الضريبي VAT (15 رقم يبدأ وينتهي بـ 3) *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="300123456700003"
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono tracking-wider font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-700"
                dir="ltr"
              />
              <p className="text-[10px] text-slate-700 mt-1">
                المسجل لدى هيئة الزكاة والضريبة والجمارك (ZATCA).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                رقم السجل التجاري (C.R)
              </label>
              <input
                type="text"
                value={crNumber}
                onChange={(e) => setCrNumber(e.target.value)}
                placeholder="1010XXXXXX"
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                المدينة
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="الرياض"
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                العنوان التفصيلي والحي
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="طريق الملك فهد، حي الصحافة"
                className="w-full p-2.5 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                رقم الهاتف / الجوال
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                البريد الإلكتروني الرسمي
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@business.sa"
                className="w-full p-2.5 rounded-lg border border-slate-300"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Invoicing Parameters */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            تفضيلات الفوترة والأرقام التسلسلية
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                بادئة رقم الفاتورة (Prefix)
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV-"
                className="w-full p-2.5 rounded-lg border border-slate-300 font-mono"
                dir="ltr"
              />
              <p className="text-[10px] text-slate-700 mt-1">
                مثال على شكل الفاتورة الناتجة:{' '}
                <span className="font-mono text-emerald-800 font-bold" dir="ltr">
                  {invoicePrefix}2026-0001
                </span>
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                نسبة ضريبة القيمة المضافة الافتراضية (%)
              </label>
              <select
                value={defaultVatRate}
                onChange={(e) => setDefaultVatRate(Number(e.target.value))}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white font-mono"
              >
                <option value={15}>15% (النسبة القياسية بالمملكة)</option>
                <option value={5}>5% (نسب مخفضة)</option>
                <option value={0}>0% (معفاة أو صفرية)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: ZATCA Phase 2 Integration (Roadmap / Reserved as requested) */}
        <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  الربط المباشر مع منصة "فاتورة" (المرحلة الثانية - الربط والتكامل)
                </h3>
                <p className="text-[11px] text-slate-400">
                  ZATCA Phase 2 Integration (Integration & Clearance / Reporting Phase)
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full">
              محجوز للمرحلة القادمة (قريباً)
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/60 text-xs text-slate-300 space-y-2 leading-relaxed">
            <p>
              النظام مصمم من حيث هيكلة البيانات، الترقيم التسلسلي، وحسابات الضريبة لدعم متطلبات الفوترة الإلكترونية (ZATCA).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-emerald-400 block font-bold mb-0.5">شهادة CSID</span>
                <span>تخزين مشفر لشهادات التشفير بعد الفحص الأمني</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-emerald-400 block font-bold mb-0.5">التوقيع الرقمي ECDSA</span>
                <span>توليد وتوقيع XML UBL 2.1 للتبادل الحكومي</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-emerald-400 block font-bold mb-0.5">الربط بـ API الهيئة</span>
                <span>إرسال تقارير الفواتير وخدمات الربط</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-emerald-700/60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ الإعدادات والتحديثات</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
