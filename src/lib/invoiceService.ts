import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Business, Customer, Product, Invoice, InvoiceItem } from '../types';
import { generateZatcaQRTLV, validateSaudiVatNumber } from './zatcaQr';
import {
  initialDemoBusiness,
  initialDemoCustomers,
  initialDemoProducts,
  createSampleInvoices,
} from './mockData';

// Local storage keys for offline or demo fallback
export const STORAGE_PREFIX = 'zatca_invoicing_';

export interface InvoiceCalculatedTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  vatTotal: number;
  grandTotal: number;
  items: InvoiceItem[];
}

/**
 * Rounds a number to exactly 2 decimal places safely avoiding floating point precision anomalies
 */
export function roundCurrency(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item subtotal, VAT amount, and line total
 */
export function calculateItemAmounts(
  quantity: number,
  unitPrice: number,
  vatRate: number
): { subtotal: number; vatAmount: number; total: number; taxableAmount: number; discount: number } {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  const safeVatRate = Math.max(0, Number(vatRate) ?? 15);

  const subtotal = roundCurrency(safeQty * safePrice);
  const vatAmount = roundCurrency((subtotal * safeVatRate) / 100);
  const total = roundCurrency(subtotal + vatAmount);

  return {
    subtotal,
    discount: 0,
    taxableAmount: subtotal,
    vatAmount,
    total,
  };
}

/**
 * Calculates the invoice grand totals and allocates invoice-level discount proportionally across lines.
 * Reconciles line taxable amounts, line VAT amounts, and line totals deterministically to exact cents.
 */
export function calculateInvoiceTotals(
  items: InvoiceItem[],
  discount: number = 0
): InvoiceCalculatedTotals {
  // 1. Calculate raw line subtotals
  const rawLineSubtotals = (items || []).map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return roundCurrency(qty * price);
  });

  const subtotal = roundCurrency(rawLineSubtotals.reduce((sum, s) => sum + s, 0));
  const safeDiscount = roundCurrency(Math.min(subtotal, Math.max(0, Number(discount) || 0)));
  const taxableAmount = roundCurrency(subtotal - safeDiscount);

  // If no items or zero subtotal
  if (!items || items.length === 0 || subtotal <= 0) {
    return {
      subtotal: 0,
      discount: 0,
      taxableAmount: 0,
      vatTotal: 0,
      grandTotal: 0,
      items: [],
    };
  }

  // 2. Allocate discount proportionally across lines
  const allocatedDiscounts: number[] = new Array(items.length).fill(0);

  if (safeDiscount > 0) {
    let currentDiscountSum = 0;
    const remainders: { idx: number; remainder: number; subtotal: number }[] = [];

    items.forEach((_, idx) => {
      const lineSubtotal = rawLineSubtotals[idx];
      if (lineSubtotal > 0) {
        const exactDiscount = (lineSubtotal / subtotal) * safeDiscount;
        const roundedDiscount = roundCurrency(exactDiscount);
        allocatedDiscounts[idx] = roundedDiscount;
        currentDiscountSum = roundCurrency(currentDiscountSum + roundedDiscount);
        remainders.push({
          idx,
          remainder: exactDiscount - roundedDiscount,
          subtotal: lineSubtotal,
        });
      }
    });

    // Reconcile rounding difference on discount (e.g. ±0.01)
    let discountDiff = roundCurrency(safeDiscount - currentDiscountSum);
    if (discountDiff !== 0 && remainders.length > 0) {
      remainders.sort((a, b) => {
        if (discountDiff > 0) {
          return b.remainder - a.remainder || b.subtotal - a.subtotal;
        } else {
          return a.remainder - b.remainder || b.subtotal - a.subtotal;
        }
      });

      const step = discountDiff > 0 ? 0.01 : -0.01;
      let rIdx = 0;
      while (Math.abs(discountDiff) >= 0.009 && rIdx < remainders.length) {
        const targetLineIdx = remainders[rIdx].idx;
        const newDisc = roundCurrency(allocatedDiscounts[targetLineIdx] + step);
        if (newDisc >= 0 && newDisc <= rawLineSubtotals[targetLineIdx]) {
          allocatedDiscounts[targetLineIdx] = newDisc;
          discountDiff = roundCurrency(discountDiff - step);
        }
        rIdx = (rIdx + 1) % remainders.length;
      }
    }
  }

  // 3. Calculate taxable amount per line
  const lineTaxableAmounts: number[] = items.map((_, idx) => {
    return roundCurrency(rawLineSubtotals[idx] - allocatedDiscounts[idx]);
  });

  // 4. Calculate line VAT and invoice target VAT
  // Group by VAT rate to calculate exact statutory VAT
  const vatRateGroups = new Map<number, number>();
  items.forEach((item, idx) => {
    const rate = Math.max(0, Number(item.vatRate) ?? 15);
    const curr = vatRateGroups.get(rate) || 0;
    vatRateGroups.set(rate, roundCurrency(curr + lineTaxableAmounts[idx]));
  });

  let targetVatTotal = 0;
  vatRateGroups.forEach((taxableForRate, rate) => {
    targetVatTotal = roundCurrency(targetVatTotal + roundCurrency((taxableForRate * rate) / 100));
  });

  // Calculate initial line VATs
  const lineVats: number[] = [];
  const vatRemainders: { idx: number; remainder: number; taxable: number; vatRate: number }[] = [];
  let currentLineVatSum = 0;

  items.forEach((item, idx) => {
    const rate = Math.max(0, Number(item.vatRate) ?? 15);
    const lineTaxable = lineTaxableAmounts[idx];
    const exactVat = (lineTaxable * rate) / 100;
    const roundedVat = roundCurrency(exactVat);
    lineVats.push(roundedVat);
    currentLineVatSum = roundCurrency(currentLineVatSum + roundedVat);

    if (rate > 0 && lineTaxable > 0) {
      vatRemainders.push({
        idx,
        remainder: exactVat - roundedVat,
        taxable: lineTaxable,
        vatRate: rate,
      });
    }
  });

  // Reconcile rounding difference on VAT (e.g. ±0.01) deterministically
  let vatDiff = roundCurrency(targetVatTotal - currentLineVatSum);
  if (vatDiff !== 0 && vatRemainders.length > 0) {
    vatRemainders.sort((a, b) => {
      if (vatDiff > 0) {
        return b.remainder - a.remainder || b.taxable - a.taxable;
      } else {
        return a.remainder - b.remainder || b.taxable - a.taxable;
      }
    });

    const step = vatDiff > 0 ? 0.01 : -0.01;
    let vIdx = 0;
    while (Math.abs(vatDiff) >= 0.009 && vIdx < vatRemainders.length) {
      const targetIdx = vatRemainders[vIdx].idx;
      lineVats[targetIdx] = roundCurrency(lineVats[targetIdx] + step);
      vatDiff = roundCurrency(vatDiff - step);
      vIdx = (vIdx + 1) % vatRemainders.length;
    }
  }

  // 5. Build final reconciled items
  const reconciledItems: InvoiceItem[] = items.map((item, idx) => {
    const itemSubtotal = rawLineSubtotals[idx];
    const itemDiscount = allocatedDiscounts[idx];
    const itemTaxable = lineTaxableAmounts[idx];
    const itemVat = lineVats[idx];
    const itemTotal = roundCurrency(itemTaxable + itemVat);

    return {
      ...item,
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      vatRate: Math.max(0, Number(item.vatRate) ?? 15),
      subtotal: itemSubtotal,
      discount: itemDiscount,
      taxableAmount: itemTaxable,
      vatAmount: itemVat,
      total: itemTotal,
    };
  });

  const grandTotal = roundCurrency(taxableAmount + targetVatTotal);

  return {
    subtotal,
    discount: safeDiscount,
    taxableAmount,
    vatTotal: targetVatTotal,
    grandTotal,
    items: reconciledItems,
  };
}

/**
 * Validates invoice payload before creation or issuance
 */
export function validateInvoice(
  invoice: Partial<Invoice>,
  business: Business
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!business.name || !business.vatNumber) {
    errors.push('بيانات المنشأة (الاسم والرقم الضريبي) غير مكتملة');
  }

  const vatCheck = validateSaudiVatNumber(business.vatNumber);
  if (!vatCheck.isValid) {
    errors.push(`الرقم الضريبي للمنشأة غير صحيح: ${vatCheck.error}`);
  }

  if (!invoice.customer || !invoice.customer.name?.trim()) {
    errors.push('يجب اختيار أو إدخال بيانات العميل للفاتورة');
  }

  if (invoice.type === 'standard' && invoice.status !== 'draft') {
    if (!invoice.customer?.vatNumber) {
      errors.push('الفاتورة الضريبية القياسية (B2B) تتطلب وجود الرقم الضريبي للعميل');
    }
  }

  if (!invoice.items || invoice.items.length === 0) {
    errors.push('يجب إضافة بند واحد على الأقل في الفاتورة');
  } else {
    invoice.items.forEach((item, index) => {
      if (!item.name?.trim()) {
        errors.push(`البند رقم ${index + 1}: اسم المنتج أو الخدمة مطلوب`);
      }
      if (item.quantity <= 0) {
        errors.push(`البند رقم ${index + 1}: الكمية يجب أن تكون أكبر من صفر`);
      }
      if (item.unitPrice < 0) {
        errors.push(`البند رقم ${index + 1}: سعر الوحدة لا يمكن أن يكون سالباً`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ----------------------------------------------------
// Firestore Sanitization Utility
// ----------------------------------------------------

/**
 * Deeply sanitizes any object or array before sending to Firestore:
 * - Recursively removes all `undefined` values so Firestore never throws
 *   "Function setDoc() called with invalid data: Unsupported field value: undefined".
 * - Safely preserves Date instances, Timestamps, and Firestore FieldValues (such as serverTimestamp()).
 * - Recursively cleans objects, arrays, and nested structures.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return null as any;
  }

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    // Preserve Date instances
    if (data instanceof Date) {
      return data;
    }

    // Preserve Firestore FieldValue instances (serverTimestamp, deleteField, etc.)
    const anyObj = data as any;
    if (
      anyObj._methodName !== undefined ||
      anyObj.constructor?.name === 'FieldValue' ||
      typeof anyObj.isEqual === 'function'
    ) {
      return data;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        // Omit undefined values completely
        continue;
      }
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = sanitizeForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  }

  return data;
}

/**
 * Universal safe setDoc wrapper that automatically sanitizes all data before sending to Firestore
 */
export async function safeSetDoc(
  docRef: any,
  data: Record<string, any>,
  options?: any
): Promise<void> {
  const sanitized = sanitizeForFirestore(data);
  if (options) {
    return setDoc(docRef, sanitized, options);
  }
  return setDoc(docRef, sanitized);
}

// ----------------------------------------------------
// Business Service
// ----------------------------------------------------

// ----------------------------------------------------
// In-flight Async Deduplication Lock
// Prevents concurrent duplicate writes from rapid clicks or race conditions
// ----------------------------------------------------
const inFlightOperations = new Map<string, Promise<any>>();

export function runDeduplicated<T>(lockKey: string, operation: () => Promise<T>): Promise<T> {
  const existing = inFlightOperations.get(lockKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    try {
      return await operation();
    } finally {
      inFlightOperations.delete(lockKey);
    }
  })();

  inFlightOperations.set(lockKey, promise);
  return promise;
}

export async function getBusiness(businessId: string): Promise<Business | null> {
  if (businessId === 'demo-business-001') {
    const stored = localStorage.getItem(STORAGE_PREFIX + 'business');
    return stored ? JSON.parse(stored) : initialDemoBusiness;
  }

  const docRef = doc(db, 'businesses', businessId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as Business;
  }
  return null;
}

export async function saveBusiness(business: Business): Promise<void> {
  const lockKey = `${business.id}:business:save`;
  return runDeduplicated(lockKey, async () => {
    if (business.id === 'demo-business-001') {
      localStorage.setItem(STORAGE_PREFIX + 'business', JSON.stringify(business));
      return;
    }

    const businessToSave: Record<string, any> = {
      id: business.id,
      name: (business.name || '').trim(),
      nameEn: (business.nameEn || '').trim(),
      vatNumber: (business.vatNumber || '').trim(),
      crNumber: (business.crNumber || '').trim(),
      address: (business.address || '').trim(),
      city: (business.city || '').trim(),
      phone: (business.phone || '').trim(),
      email: (business.email || '').trim(),
      defaultVatRate: Number(business.defaultVatRate) || 15,
      invoicePrefix: (business.invoicePrefix || 'INV-').trim(),
      ownerId: business.ownerId || business.id,
      createdAt: business.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (business.logoUrl && business.logoUrl.trim()) {
      businessToSave.logoUrl = business.logoUrl.trim();
    }

    const docRef = doc(db, 'businesses', business.id);
    await safeSetDoc(docRef, businessToSave, { merge: true });
  });
}

// ----------------------------------------------------
// Customers Service
// ----------------------------------------------------

export async function getCustomers(businessId: string): Promise<Customer[]> {
  if (businessId === 'demo-business-001') {
    const stored = localStorage.getItem(STORAGE_PREFIX + 'customers');
    return stored ? JSON.parse(stored) : initialDemoCustomers;
  }

  const colRef = collection(db, 'businesses', businessId, 'customers');
  const snap = await getDocs(colRef);
  if (snap.empty) {
    return [];
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

export async function saveCustomer(businessId: string, customer: Customer): Promise<Customer> {
  const resolvedId = customer.id || `cust-${Date.now()}`;
  const lockKey = `${businessId}:customer:${customer.id || `${customer.name.trim().toLowerCase()}-${(customer.phone || '').trim()}`}`;

  return runDeduplicated(lockKey, async () => {
    const customerToSave: Customer = {
      id: resolvedId,
      name: (customer.name || '').trim(),
      phone: (customer.phone || '').trim(),
      address: (customer.address || '').trim() || 'المملكة العربية السعودية',
      createdAt: customer.createdAt || new Date().toISOString(),
    };

    if (customer.nameEn && customer.nameEn.trim()) {
      customerToSave.nameEn = customer.nameEn.trim();
    }
    if (customer.email && customer.email.trim()) {
      customerToSave.email = customer.email.trim();
    }
    if (customer.vatNumber && customer.vatNumber.trim()) {
      customerToSave.vatNumber = customer.vatNumber.trim();
    }

    if (businessId === 'demo-business-001') {
      const customers = await getCustomers(businessId);
      const idx = customers.findIndex((c) => c.id === customerToSave.id);
      if (idx >= 0) {
        customers[idx] = customerToSave;
      } else {
        customers.push(customerToSave);
      }
      localStorage.setItem(STORAGE_PREFIX + 'customers', JSON.stringify(customers));
      return customerToSave;
    }

    const docRef = doc(db, 'businesses', businessId, 'customers', customerToSave.id);
    await safeSetDoc(docRef, customerToSave);
    return customerToSave;
  });
}

export async function deleteCustomer(businessId: string, customerId: string): Promise<void> {
  if (businessId === 'demo-business-001') {
    const customers = await getCustomers(businessId);
    const filtered = customers.filter((c) => c.id !== customerId);
    localStorage.setItem(STORAGE_PREFIX + 'customers', JSON.stringify(filtered));
    return;
  }

  const docRef = doc(db, 'businesses', businessId, 'customers', customerId);
  await deleteDoc(docRef);
}

// ----------------------------------------------------
// Products Service
// ----------------------------------------------------

export async function getProducts(businessId: string): Promise<Product[]> {
  if (businessId === 'demo-business-001') {
    const stored = localStorage.getItem(STORAGE_PREFIX + 'products');
    return stored ? JSON.parse(stored) : initialDemoProducts;
  }

  const colRef = collection(db, 'businesses', businessId, 'products');
  const snap = await getDocs(colRef);
  if (snap.empty) {
    return [];
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function saveProduct(businessId: string, product: Product): Promise<Product> {
  const resolvedId = product.id || `prod-${Date.now()}`;
  const lockKey = `${businessId}:product:${product.id || `${product.name.trim().toLowerCase()}-${product.price}`}`;

  return runDeduplicated(lockKey, async () => {
    const productToSave: Product = {
      id: resolvedId,
      name: (product.name || '').trim(),
      price: Number(product.price) || 0,
      unit: (product.unit || 'قطعة').trim(),
      vatRate: Number(product.vatRate) ?? 15,
      category: (product.category || 'عام').trim(),
      createdAt: product.createdAt || new Date().toISOString(),
    };

    // Optional fields: omit if empty/undefined, or store trimmed string
    if (product.nameEn && product.nameEn.trim()) {
      productToSave.nameEn = product.nameEn.trim();
    }

    if (businessId === 'demo-business-001') {
      const products = await getProducts(businessId);
      const idx = products.findIndex((p) => p.id === productToSave.id);
      if (idx >= 0) {
        products[idx] = productToSave;
      } else {
        products.push(productToSave);
      }
      localStorage.setItem(STORAGE_PREFIX + 'products', JSON.stringify(products));
      return productToSave;
    }

    const docRef = doc(db, 'businesses', businessId, 'products', productToSave.id);
    await safeSetDoc(docRef, productToSave);
    return productToSave;
  });
}

export async function deleteProduct(businessId: string, productId: string): Promise<void> {
  if (businessId === 'demo-business-001') {
    const products = await getProducts(businessId);
    const filtered = products.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_PREFIX + 'products', JSON.stringify(filtered));
    return;
  }

  const docRef = doc(db, 'businesses', businessId, 'products', productId);
  await deleteDoc(docRef);
}

// ----------------------------------------------------
// Invoices Service (Atomic Sequential Numbering & Isolation)
// ----------------------------------------------------

export async function getInvoices(businessId: string): Promise<Invoice[]> {
  if (businessId === 'demo-business-001') {
    const stored = localStorage.getItem(STORAGE_PREFIX + 'invoices');
    if (stored) return JSON.parse(stored);
    const samples = createSampleInvoices(initialDemoBusiness);
    localStorage.setItem(STORAGE_PREFIX + 'invoices', JSON.stringify(samples));
    return samples;
  }

  const colRef = collection(db, 'businesses', businessId, 'invoices');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
}

/**
 * Generates an atomic sequential invoice number for the business.
 * Uses a Firestore transaction on the business counter document to guarantee uniqueness under concurrency.
 */
export async function getNextSequentialInvoiceNumber(
  businessId: string,
  prefix: string = 'INV-'
): Promise<{ invoiceNumber: string; sequenceNumber: number }> {
  const currentYear = new Date().getFullYear();

  if (businessId === 'demo-business-001') {
    const invoices = await getInvoices(businessId);
    const maxSeq = invoices.reduce((max, inv) => Math.max(max, inv.sequenceNumber || 0), 0);
    const nextSeq = maxSeq + 1;
    const formattedNum = `${prefix}${currentYear}-${String(nextSeq).padStart(4, '0')}`;
    return { invoiceNumber: formattedNum, sequenceNumber: nextSeq };
  }

  const counterDocRef = doc(db, 'businesses', businessId, 'counters', 'invoices');
  const result = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterDocRef);
    let currentSeq = 0;
    if (counterDoc.exists()) {
      currentSeq = counterDoc.data().lastSequenceNumber || 0;
    }
    const nextSeq = currentSeq + 1;
    transaction.set(
      counterDocRef,
      sanitizeForFirestore({
        lastSequenceNumber: nextSeq,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    const formattedNum = `${prefix}${currentYear}-${String(nextSeq).padStart(4, '0')}`;
    return { invoiceNumber: formattedNum, sequenceNumber: nextSeq };
  });

  return result;
}

/**
 * Creates or updates an invoice.
 * Generates official ZATCA QR Code TLV automatically for issued invoices.
 */
export async function saveInvoice(
  businessId: string,
  business: Business,
  invoiceData: Partial<Invoice>
): Promise<Invoice> {
  const lockKey = `${businessId}:invoice:${invoiceData.id || `${invoiceData.customer?.id || 'cust'}-${invoiceData.issueDate || ''}-${invoiceData.items?.length || 0}-${invoiceData.status || 'issued'}`}`;

  return runDeduplicated(lockKey, async () => {
    const validation = validateInvoice(invoiceData, business);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(' | '));
    }

    const isNew = !invoiceData.id;
    const id = invoiceData.id || `inv-${Date.now()}`;
    const status = invoiceData.status || 'issued';

    let invoiceNumber = invoiceData.invoiceNumber;
    let sequenceNumber = invoiceData.sequenceNumber || 1;

    if (isNew || !invoiceNumber) {
      const nextInfo = await getNextSequentialInvoiceNumber(businessId, business.invoicePrefix || 'INV-');
      invoiceNumber = nextInfo.invoiceNumber;
      sequenceNumber = nextInfo.sequenceNumber;
    }

    const items: InvoiceItem[] = (invoiceData.items || []).map((item, idx) => {
      const amounts = calculateItemAmounts(item.quantity, item.unitPrice, item.vatRate);
      const cleanedItem: InvoiceItem = {
        id: item.id || `item-${idx + 1}-${Date.now()}`,
        name: (item.name || '').trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        vatRate: Number(item.vatRate) ?? 15,
        subtotal: amounts.subtotal,
        vatAmount: amounts.vatAmount,
        total: amounts.total,
      };
      if (item.productId && item.productId.trim()) {
        cleanedItem.productId = item.productId.trim();
      }
      if (item.nameEn && item.nameEn.trim()) {
        cleanedItem.nameEn = item.nameEn.trim();
      }
      return cleanedItem;
    });

    const totals = calculateInvoiceTotals(items, invoiceData.discount || 0);
    const issueDate = invoiceData.issueDate || new Date().toISOString();

    // Generate ZATCA QR TLV Base64
    let qrCode = invoiceData.qrCode;
    if (status === 'issued' || !qrCode) {
      qrCode = generateZatcaQRTLV({
        sellerName: business.name,
        vatNumber: business.vatNumber,
        timestamp: issueDate,
        totalWithVat: totals.grandTotal,
        vatTotal: totals.vatTotal,
      });
    }

    const rawCustomer = invoiceData.customer!;
    const cleanedCustomer: Customer = {
      id: rawCustomer.id || `cust-${Date.now()}`,
      name: (rawCustomer.name || '').trim(),
      phone: (rawCustomer.phone || '').trim(),
      address: (rawCustomer.address || '').trim() || 'المملكة العربية السعودية',
    };
    if (rawCustomer.nameEn && rawCustomer.nameEn.trim()) {
      cleanedCustomer.nameEn = rawCustomer.nameEn.trim();
    }
    if (rawCustomer.email && rawCustomer.email.trim()) {
      cleanedCustomer.email = rawCustomer.email.trim();
    }
    if (rawCustomer.vatNumber && rawCustomer.vatNumber.trim()) {
      cleanedCustomer.vatNumber = rawCustomer.vatNumber.trim();
    }

    const invoiceToSave: Record<string, any> = {
      id,
      invoiceNumber,
      sequenceNumber,
      issueDate,
      supplyDate: invoiceData.supplyDate || issueDate.split('T')[0],
      type: invoiceData.type || 'simplified',
      status,
      customer: cleanedCustomer,
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxableAmount: totals.taxableAmount,
      vatTotal: totals.vatTotal,
      grandTotal: totals.grandTotal,
      notes: (invoiceData.notes || '').trim(),
      qrCode: qrCode || '',
      createdAt: invoiceData.createdAt || issueDate,
      updatedAt: new Date().toISOString(),
    };

    if (invoiceData.dueDate && invoiceData.dueDate.trim()) {
      invoiceToSave.dueDate = invoiceData.dueDate.trim();
    }
    if (invoiceData.originalInvoiceId && invoiceData.originalInvoiceId.trim()) {
      invoiceToSave.originalInvoiceId = invoiceData.originalInvoiceId.trim();
    }

    if (businessId === 'demo-business-001') {
      const invoices = await getInvoices(businessId);
      const idx = invoices.findIndex((i) => i.id === invoiceToSave.id);
      if (idx >= 0) {
        invoices[idx] = invoiceToSave as Invoice;
      } else {
        invoices.unshift(invoiceToSave as Invoice);
      }
      localStorage.setItem(STORAGE_PREFIX + 'invoices', JSON.stringify(invoices));
      return invoiceToSave as Invoice;
    }

    try {
      const docRef = doc(db, 'businesses', businessId, 'invoices', invoiceToSave.id);
      await safeSetDoc(docRef, invoiceToSave);
      return invoiceToSave as Invoice;
    } catch (err: any) {
      console.error('Error saving invoice to Firestore:', err);
      throw new Error('فشل حفظ الفاتورة: ' + (err.message || 'خطأ غير معروف'));
    }
  });
}

/**
 * Updates status of an invoice (e.g. issued, cancelled, refunded)
 */
export async function updateInvoiceStatus(
  businessId: string,
  invoiceId: string,
  newStatus: Invoice['status']
): Promise<void> {
  const lockKey = `${businessId}:invoice:${invoiceId}:status:${newStatus}`;
  return runDeduplicated(lockKey, async () => {
    if (businessId === 'demo-business-001') {
      const invoices = await getInvoices(businessId);
      const target = invoices.find((i) => i.id === invoiceId);
      if (target) {
        target.status = newStatus;
        target.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_PREFIX + 'invoices', JSON.stringify(invoices));
      }
      return;
    }

    try {
      const docRef = doc(db, 'businesses', businessId, 'invoices', invoiceId);
      await safeSetDoc(docRef, { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err: any) {
      throw new Error('فشل تحديث حالة الفاتورة: ' + (err.message || 'خطأ غير معروف'));
    }
  });
}
