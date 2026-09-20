export interface Business {
  id: string;
  name: string;
  nameEn: string;
  vatNumber: string; // 15 digits starting and ending with 3 (Saudi standard)
  crNumber: string;  // Commercial Registration
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl?: string;
  defaultVatRate: number; // typically 15
  invoicePrefix: string;  // e.g. "INV-"
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  nameEn?: string;
  phone: string;
  email?: string;
  vatNumber?: string; // Optional for B2C, required for B2B standard invoices
  address: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  price: number; // Unit price excluding VAT
  unit: string;  // e.g. "قطعة", "ساعة", "خدمة", "كجم"
  vatRate: number; // e.g. 15
  category?: string;
  createdAt?: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  name: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number; // Excluding VAT
  vatRate: number;   // Percentage, e.g. 15
  subtotal: number;  // Calculated: quantity * unitPrice (line amount before discount)
  discount?: number; // Allocated invoice-level discount for this line in SAR
  taxableAmount?: number; // Calculated: subtotal - (discount || 0)
  vatAmount: number; // Calculated: taxableAmount * (vatRate / 100)
  total: number;     // Calculated: taxableAmount + vatAmount
}

export type InvoiceStatus = 'draft' | 'issued' | 'cancelled' | 'refunded';
export type InvoiceType = 'simplified' | 'standard' | 'credit_note' | 'debit_note';

export interface Invoice {
  id: string;
  invoiceNumber: string;      // e.g. INV-2026-0001
  sequenceNumber: number;     // e.g. 1
  issueDate: string;          // ISO 8601 string: 2026-09-19T10:30:00Z
  dueDate?: string;
  supplyDate?: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customer: Customer;
  items: InvoiceItem[];
  subtotal: number;           // Total before VAT and discount
  discount: number;           // Discount amount in SAR
  taxableAmount: number;      // subtotal - discount
  vatTotal: number;           // Total VAT amount in SAR
  grandTotal: number;         // taxableAmount + vatTotal
  notes?: string;
  qrCode?: string;            // ZATCA TLV Base64 representation
  originalInvoiceId?: string; // For credit / debit notes
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceSummaryStats {
  totalSales: number;
  totalVat: number;
  invoicesCount: number;
  averageInvoiceValue: number;
  issuedCount: number;
  draftCount: number;
  needsReviewCount: number;
}

export interface TestCaseResult {
  id: string;
  titleAr: string;
  titleEn: string;
  passed: boolean;
  details: string;
  expected?: string;
  actual?: string;
}
