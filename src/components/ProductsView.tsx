import React, { useState, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  AlertCircle,
  Percent,
  Loader2,
} from 'lucide-react';
import { Product } from '../types';

interface ProductsViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => Promise<Product>;
  onDeleteProduct: (productId: string) => Promise<void>;
  defaultVatRate?: number;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  defaultVatRate = 15,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formUnit, setFormUnit] = useState('خدمة');
  const [formVatRate, setFormVatRate] = useState(defaultVatRate);
  const [formCategory, setFormCategory] = useState('خدمات');

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category || 'عام'));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory =
        categoryFilter === 'all' || (p.category || 'عام') === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const openNewProductModal = () => {
    pendingIdRef.current = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEditingProduct(null);
    setFormName('');
    setFormNameEn('');
    setFormPrice('');
    setFormUnit('خدمة');
    setFormVatRate(defaultVatRate);
    setFormCategory('خدمات');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    pendingIdRef.current = product.id;
    setEditingProduct(product);
    setFormName(product.name);
    setFormNameEn(product.nameEn || '');
    setFormPrice(product.price);
    setFormUnit(product.unit || 'خدمة');
    setFormVatRate(product.vatRate);
    setFormCategory(product.category || 'خدمات');
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
      setErrorMsg('اسم السلعة أو الخدمة مطلوب');
      return;
    }

    const priceNum = Number(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('السعر يجب أن يكون رقماً موجباً أو صفراً');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : (pendingIdRef.current || `prod-${Date.now()}`),
      name: formName.trim(),
      nameEn: formNameEn.trim() || undefined,
      price: priceNum,
      unit: formUnit.trim() || 'قطعة',
      vatRate: Number(formVatRate) || 15,
      category: formCategory.trim() || 'عام',
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
    };

    try {
      await onSaveProduct(productToSave);
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ المنتج');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (deletingRef.current || deletingId) return;
    if (confirm(`هل أنت متأكد من حذف المنتج "${name}"؟`)) {
      deletingRef.current = id;
      setDeletingId(id);
      try {
        await onDeleteProduct(id);
      } catch (err: any) {
        alert('فشل الحذف: ' + err.message);
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
            كتالوج المنتجات والخدمات
          </h1>
          <p className="text-xs text-slate-700 mt-0.5">
            إدارة السلع، الخدمات، الأسعار، ونسب ضريبة القيمة المضافة لإدراجها السريع في الفواتير
          </p>
        </div>

        <button
          onClick={openNewProductModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج أو خدمة</span>
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث باسم المنتج أو الخدمة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pr-9 pl-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-700 font-medium">التصنيف:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'جميع التصنيفات' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-slate-200 text-center text-slate-700 space-y-2">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">لا توجد منتجات مطابقة</p>
          <p className="text-xs text-slate-700">أضف خدمات أو منتجات لتسهيل إنشاء الفواتير بنقرة واحدة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const vatAmount = (product.price * product.vatRate) / 100;
            const priceWithVat = product.price + vatAmount;

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{product.name}</h3>
                      {product.nameEn && (
                        <p className="text-[11px] text-slate-700" dir="ltr">
                          {product.nameEn}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-800">
                      {product.category || 'عام'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">السعر غير شامل الضريبة:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {product.price.toFixed(2)} ر.س / {product.unit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600">الضريبة ({product.vatRate}%):</span>
                      <span className="font-mono text-emerald-800">
                        +{vatAmount.toFixed(2)} ر.س
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-dashed border-slate-200">
                      <span className="text-slate-900">السعر شامل الضريبة 15%:</span>
                      <span className="font-mono text-emerald-800 text-sm">
                        {priceWithVat.toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => openEditProductModal(product)}
                    className="p-1.5 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => handleDelete(product.id, product.name)}
                    className="p-1.5 text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add/Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingProduct ? 'تعديل بيانات المنتج / الخدمة' : 'إضافة منتج أو خدمة جديدة'}
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
                  اسم السلعة أو الخدمة *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: رخصة برنامج سنوية"
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
                  placeholder="Annual Software License"
                  className="w-full p-2 rounded-lg border border-slate-300"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    السعر قبل الضريبة (ر.س) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full p-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الوحدة
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="خدمة">خدمة</option>
                    <option value="ساعة">ساعة</option>
                    <option value="قطعة">قطعة</option>
                    <option value="مشروع">مشروع</option>
                    <option value="شهر">شهر</option>
                    <option value="اشتراك سنوي">اشتراك سنوي</option>
                    <option value="كجم">كجم</option>
                    <option value="متر">متر</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    نسبة الضريبة (%)
                  </label>
                  <select
                    value={formVatRate}
                    onChange={(e) => setFormVatRate(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono"
                  >
                    <option value={15}>15% (النسبة الأساسية ZATCA)</option>
                    <option value={5}>5% (نسبة مخفضة)</option>
                    <option value={0}>0% (صفرية / معفاة)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    التصنيف
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="مثال: برمجيات، استشارات..."
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Calculated price preview */}
              {formPrice !== '' && Number(formPrice) >= 0 && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-700 flex justify-between">
                  <span>السعر النهائي شامل الضريبة:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {(Number(formPrice) * (1 + Number(formVatRate) / 100)).toFixed(2)} ر.س
                  </span>
                </div>
              )}

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
                    <span>{editingProduct ? 'حفظ التعديلات' : 'حفظ المنتج'}</span>
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
