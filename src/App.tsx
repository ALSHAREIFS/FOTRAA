/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Business, Customer, Product, Invoice, InvoiceStatus } from './types';
import { initialDemoBusiness } from './lib/mockData';
import {
  getBusiness,
  saveBusiness,
  getInvoices,
  saveInvoice,
  updateInvoiceStatus,
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getProducts,
  saveProduct,
  deleteProduct,
} from './lib/invoiceService';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InvoicesListView } from './components/InvoicesListView';
import { InvoiceFormView } from './components/InvoiceFormView';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { CustomersView } from './components/CustomersView';
import { ProductsView } from './components/ProductsView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { TestsModal } from './components/TestsModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [business, setBusiness] = useState<Business>(initialDemoBusiness);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isTestsModalOpen, setIsTestsModalOpen] = useState<boolean>(false);

  // Notification helper
  const notify = (message: string) => {
    setStatusNotification(message);
    setTimeout(() => {
      setStatusNotification(null);
    }, 5000);
  };

  // Load business data and subcollections
  const loadBusinessData = useCallback(async (bizId: string) => {
    setIsLoading(true);
    setFirestoreError(null);
    try {
      let biz = await getBusiness(bizId);
      if (!biz) {
        // First-time business bootstrap for this user
        biz = {
          id: bizId,
          name: 'منشأتي للخدمات والتجارة',
          nameEn: 'My Enterprise Est.',
          vatNumber: '300987654300003',
          crNumber: '1010778899',
          address: 'المملكة العربية السعودية',
          city: 'الرياض',
          phone: '',
          email: currentUser?.email || 'admin@myenterprise.sa',
          defaultVatRate: 15,
          invoicePrefix: 'INV-',
          ownerId: bizId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveBusiness(biz);
      }
      setBusiness(biz);

      const [loadedInvoices, loadedCustomers, loadedProducts] = await Promise.all([
        getInvoices(biz.id),
        getCustomers(biz.id),
        getProducts(biz.id),
      ]);

      setInvoices(loadedInvoices);
      setCustomers(loadedCustomers);
      setProducts(loadedProducts);
    } catch (err: any) {
      console.error('Failed to load business data from Firebase:', err);
      const msg = err?.message || err?.code || 'فشل الاتصال بقاعدة بيانات Firebase';
      setFirestoreError(msg);
      notify(`خطأ في استرجاع بيانات Firebase: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsDemoMode(false);
        await loadBusinessData(user.uid);
      } else {
        setCurrentUser(null);
        setIsDemoMode(true);
        await loadBusinessData('demo-business-001');
      }
    });

    return () => unsubscribe();
  }, [loadBusinessData]);

  // Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    setIsDemoMode(true);
    notify('تم تسجيل الخروج بنجاح. تم التبديل إلى المنشأة النموذجية');
    await loadBusinessData('demo-business-001');
  };

  // Success Auth handler
  const handleSuccessAuth = async (
    userId: string,
    email: string,
    businessData?: Partial<Business>
  ) => {
    setIsDemoMode(false);
    if (businessData) {
      setBusiness((prev) => ({
        ...prev,
        ...businessData,
        id: userId,
        ownerId: userId,
        email,
      } as Business));
    }
    await loadBusinessData(userId);
    notify('تم تسجيل الدخول وتجهيز بيانات المنشأة السحابية بنجاح');
  };

  // Invoice Actions
  const handleOpenNewInvoice = () => {
    setEditingInvoice(null);
    setActiveTab('new-invoice');
  };

  const handleEditDraft = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setActiveTab('new-invoice');
    notify(`جارِ تعديل مسودة الفاتورة: ${invoice.invoiceNumber}`);
  };

  const handleSaveInvoice = async (
    invoiceData: Partial<Invoice>,
    asDraft: boolean
  ) => {
    try {
      const saved = await saveInvoice(business.id, business, invoiceData);
      // Reload invoices
      const updated = await getInvoices(business.id);
      setInvoices(updated);
      setSelectedInvoice(saved);
      setEditingInvoice(null);
      setActiveTab('invoices');
      notify(
        asDraft
          ? (invoiceData.id ? `تم حفظ تعديلات المسودة ${saved.invoiceNumber} بنجاح` : 'تم حفظ الفاتورة كمسودة بنجاح')
          : `تم إصدار الفاتورة ${saved.invoiceNumber} مع رمز ZATCA QR بنجاح`
      );
    } catch (err: any) {
      notify('فشل حفظ الفاتورة: ' + (err.message || 'خطأ غير معروف'));
      throw err;
    }
  };

  const handleUpdateStatus = async (
    invoiceId: string,
    newStatus: InvoiceStatus
  ) => {
    try {
      await updateInvoiceStatus(business.id, invoiceId, newStatus);
      const updated = await getInvoices(business.id);
      setInvoices(updated);
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status: newStatus });
      }
      notify(`تم تحديث حالة الفاتورة إلى: ${newStatus}`);
    } catch (err: any) {
      notify('فشل تحديث الحالة: ' + err.message);
    }
  };

  const handleCreateCreditNote = (originalInvoice: Invoice) => {
    // Navigate to new invoice prepopulated as credit note
    setActiveTab('new-invoice');
    notify(`جارِ إنشاء إشعار دائن (مرتجع) للفاتورة ${originalInvoice.invoiceNumber}`);
  };

  // Customer Actions
  const handleSaveCustomer = async (cust: Customer): Promise<Customer> => {
    const saved = await saveCustomer(business.id, cust);
    const updated = await getCustomers(business.id);
    setCustomers(updated);
    notify(`تم حفظ بيانات العميل "${cust.name}"`);
    return saved;
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteCustomer(business.id, id);
    const updated = await getCustomers(business.id);
    setCustomers(updated);
    notify('تم حذف العميل بنجاح');
  };

  // Product Actions
  const handleSaveProduct = async (prod: Product): Promise<Product> => {
    const saved = await saveProduct(business.id, prod);
    const updated = await getProducts(business.id);
    setProducts(updated);
    notify(`تم حفظ المنتج / الخدمة "${prod.name}"`);
    return saved;
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(business.id, id);
    const updated = await getProducts(business.id);
    setProducts(updated);
    notify('تم حذف المنتج بنجاح');
  };

  // Settings Action
  const handleSaveBusiness = async (updatedBiz: Business) => {
    await saveBusiness(updatedBiz);
    setBusiness(updatedBiz);
    notify('تم حفظ وتحديث إعدادات المنشأة');
  };

  // Invoices needing review calculation
  const needingReviewCount = invoices.filter(
    (i) => i.status === 'draft' || (i.type === 'standard' && !i.customer.vatNumber)
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans" dir="rtl">
      {/* Top Notification Toast */}
      {statusNotification && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        business={business}
        isDemo={isDemoMode}
        onOpenNewInvoice={handleOpenNewInvoice}
        onOpenTests={() => setIsTestsModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onNavigate={(tab) => {
          if (tab === 'new-invoice') setEditingInvoice(null);
          setActiveTab(tab);
        }}
      />

      {/* App Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'tests') {
              setIsTestsModalOpen(true);
            } else {
              if (tab === 'new-invoice') {
                setEditingInvoice(null);
              }
              setActiveTab(tab);
            }
          }}
          invoicesNeedingReviewCount={needingReviewCount}
        />

        {/* Mobile Navigation Tabs (visible on small screens) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around py-2 px-1 text-[11px] font-medium no-print shadow-lg">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === 'dashboard' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <span>الرئيسية</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex flex-col items-center py-1 px-2 rounded-lg relative ${
              activeTab === 'invoices' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <span>الفواتير</span>
            {needingReviewCount > 0 && (
              <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
          <button
            onClick={handleOpenNewInvoice}
            className="flex flex-col items-center py-1 px-3 bg-emerald-700 text-white rounded-xl shadow-xs font-bold text-xs"
          >
            <span>+ فاتورة</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === 'customers' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <span>العملاء</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex flex-col items-center py-1 px-2 rounded-lg ${
              activeTab === 'products' ? 'text-emerald-700 font-bold' : 'text-slate-500'
            }`}
          >
            <span>المنتجات</span>
          </button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {/* Firestore Error Alert for Real Accounts */}
            {firestoreError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <span className="p-1.5 bg-rose-100 rounded-lg text-rose-700 font-bold shrink-0">⚠️</span>
                  <div>
                    <p className="font-bold text-rose-800">خطأ في الاتصال بقاعدة بيانات Firebase</p>
                    <p className="text-rose-700 mt-0.5 text-xs font-mono" dir="ltr">{firestoreError}</p>
                    <p className="text-rose-600 mt-1 text-[11px]">
                      ملاحظة: إذا ظهرت رسالة الصلاحيات (permission-denied)، يرجى التأكد من نشر قواعد الأمان (Firestore Security Rules) في مشروع Firebase الخاص بك.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => loadBusinessData(currentUser ? currentUser.uid : business.id)}
                  className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white font-bold rounded-xl text-xs shrink-0 shadow-xs transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="min-h-[400px] flex items-center justify-center flex-col gap-3 text-slate-500">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold">جارِ تحميل بيانات المنشأة ونظام الفوترة...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    invoices={invoices}
                    business={business}
                    onNavigate={(tab) => setActiveTab(tab)}
                    onViewInvoice={(inv) => setSelectedInvoice(inv)}
                    onNewInvoice={handleOpenNewInvoice}
                    onEditDraft={handleEditDraft}
                  />
                )}

                {activeTab === 'invoices' && (
                  <InvoicesListView
                    invoices={invoices}
                    business={business}
                    onViewInvoice={(inv) => setSelectedInvoice(inv)}
                    onNewInvoice={handleOpenNewInvoice}
                    onUpdateStatus={handleUpdateStatus}
                    onCreateCreditNote={handleCreateCreditNote}
                    onEditDraft={handleEditDraft}
                  />
                )}

                {activeTab === 'new-invoice' && (
                  <InvoiceFormView
                    business={business}
                    customers={customers}
                    products={products}
                    onSaveInvoice={handleSaveInvoice}
                    onCancel={() => {
                      setEditingInvoice(null);
                      setActiveTab('invoices');
                    }}
                    onAddCustomer={handleSaveCustomer}
                    initialInvoice={editingInvoice}
                  />
                )}

                {activeTab === 'customers' && (
                  <CustomersView
                    customers={customers}
                    onSaveCustomer={handleSaveCustomer}
                    onDeleteCustomer={handleDeleteCustomer}
                  />
                )}

                {activeTab === 'products' && (
                  <ProductsView
                    products={products}
                    onSaveProduct={handleSaveProduct}
                    onDeleteProduct={handleDeleteProduct}
                    defaultVatRate={business.defaultVatRate}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    business={business}
                    onSaveBusiness={handleSaveBusiness}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Invoice Detail & Print Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          business={business}
          onClose={() => setSelectedInvoice(null)}
          onUpdateStatus={(status) => handleUpdateStatus(selectedInvoice.id, status)}
          onEditDraft={handleEditDraft}
        />
      )}

      {/* System Tests Modal */}
      {isTestsModalOpen && (
        <TestsModal onClose={() => setIsTestsModalOpen(false)} />
      )}

      {/* Firebase Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccessAuth={handleSuccessAuth}
        onUseDemo={() => {
          setIsDemoMode(true);
          loadBusinessData('demo-business-001');
          notify('تم تفعيل الحساب التجريبي النموذجي');
        }}
      />
    </div>
  );
}
