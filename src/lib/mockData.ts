import { Business, Customer, Product, Invoice } from '../types';
import { generateZatcaQRTLV } from './zatcaQr';

export const initialDemoBusiness: Business = {
  id: 'demo-business-001',
  name: 'مؤسسة الأفق للتقنية والتجارة',
  nameEn: 'Al-Ofuq Technology & Trading Est.',
  vatNumber: '300123456700003',
  crNumber: '1010892341',
  address: 'طريق الملك فهد، حي الصحافة',
  city: 'الرياض',
  phone: '0551234567',
  email: 'info@al-ofuq.sa',
  logoUrl: '',
  defaultVatRate: 15,
  invoicePrefix: 'INV-',
  ownerId: 'demo-user',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-09-19T09:00:00Z',
};

export const initialDemoCustomers: Customer[] = [
  {
    id: 'cust-001',
    name: 'شركة الرواد للحلول الرقمية',
    nameEn: 'Al-Rowad Digital Solutions Ltd',
    phone: '0501112233',
    email: 'finance@alrowad.com.sa',
    vatNumber: '310987654300003',
    address: 'حي العليا، الرياض',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'cust-002',
    name: 'سلطان عبدالله الدوسري',
    nameEn: 'Sultan Abdullah Al-Dawsari',
    phone: '0548889900',
    email: 'sultan.d@gmail.com',
    address: 'حي النرجس، الرياض',
    createdAt: '2026-02-01T12:00:00Z',
  },
  {
    id: 'cust-003',
    name: 'مؤسسة إعمار المستقبل للمقاولات',
    nameEn: 'Future Emaar Contracting Est.',
    phone: '0567778899',
    email: 'contracts@emaar-future.sa',
    vatNumber: '302345678900003',
    address: 'طريق الملك عبدالله، جدة',
    createdAt: '2026-03-05T09:30:00Z',
  },
];

export const initialDemoProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'تطوير وتصميم واجهة مستخدم مخصصة',
    nameEn: 'Custom UI/UX Design & Development',
    price: 3500,
    unit: 'مشروع',
    vatRate: 15,
    category: 'خدمات برمجية',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-002',
    name: 'اشتراك نظام سحابي سنوي (SaaS)',
    nameEn: 'Annual Cloud Subscription (SaaS)',
    price: 2400,
    unit: 'اشتراك سنوي',
    vatRate: 15,
    category: 'اشتراكات',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-003',
    name: 'استشارات تقنية ودعم فني متخصص',
    nameEn: 'Technical Consulting & Premium Support',
    price: 300,
    unit: 'ساعة',
    vatRate: 15,
    category: 'استشارات',
    createdAt: '2026-01-12T11:00:00Z',
  },
  {
    id: 'prod-004',
    name: 'جهاز نقطة بيع ذكي وشامل للضريبة',
    nameEn: 'Smart POS Terminal (ZATCA Ready)',
    price: 1850,
    unit: 'جهاز',
    vatRate: 15,
    category: 'أجهزة',
    createdAt: '2026-02-20T14:00:00Z',
  },
];

export function createSampleInvoices(business: Business): Invoice[] {
  const inv1Date = '2026-09-18T10:30:00Z';
  const inv1Subtotal = 4700;
  const inv1Vat = 705;
  const inv1Grand = 5405;

  const inv1Qr = generateZatcaQRTLV({
    sellerName: business.name,
    vatNumber: business.vatNumber,
    timestamp: inv1Date,
    totalWithVat: inv1Grand,
    vatTotal: inv1Vat,
  });

  const inv2Date = '2026-09-19T08:15:00Z';
  const inv2Subtotal = 2400;
  const inv2Vat = 360;
  const inv2Grand = 2760;

  const inv2Qr = generateZatcaQRTLV({
    sellerName: business.name,
    vatNumber: business.vatNumber,
    timestamp: inv2Date,
    totalWithVat: inv2Grand,
    vatTotal: inv2Vat,
  });

  const inv3Date = '2026-09-15T16:00:00Z';
  const inv3Subtotal = 900;
  const inv3Vat = 135;
  const inv3Grand = 1035;

  const inv3Qr = generateZatcaQRTLV({
    sellerName: business.name,
    vatNumber: business.vatNumber,
    timestamp: inv3Date,
    totalWithVat: inv3Grand,
    vatTotal: inv3Vat,
  });

  return [
    {
      id: 'inv-001',
      invoiceNumber: 'INV-2026-0001',
      sequenceNumber: 1,
      issueDate: inv1Date,
      dueDate: '2026-10-02',
      supplyDate: '2026-09-18',
      type: 'standard',
      status: 'issued',
      customer: initialDemoCustomers[0],
      items: [
        {
          id: 'item-1',
          productId: 'prod-001',
          name: 'تطوير وتصميم واجهة مستخدم مخصصة',
          quantity: 1,
          unitPrice: 3500,
          vatRate: 15,
          subtotal: 3500,
          vatAmount: 525,
          total: 4025,
        },
        {
          id: 'item-2',
          productId: 'prod-003',
          name: 'استشارات تقنية ودعم فني متخصص',
          quantity: 4,
          unitPrice: 300,
          vatRate: 15,
          subtotal: 1200,
          vatAmount: 180,
          total: 1380,
        },
      ],
      subtotal: inv1Subtotal,
      discount: 0,
      taxableAmount: inv1Subtotal,
      vatTotal: inv1Vat,
      grandTotal: inv1Grand,
      notes: 'شكراً لتعاملكم معنا. الدفع عبر التحويل البنكي خلال 14 يوماً.',
      qrCode: inv1Qr,
      createdAt: inv1Date,
    },
    {
      id: 'inv-002',
      invoiceNumber: 'INV-2026-0002',
      sequenceNumber: 2,
      issueDate: inv2Date,
      dueDate: '2026-09-19',
      supplyDate: '2026-09-19',
      type: 'simplified',
      status: 'issued',
      customer: initialDemoCustomers[1],
      items: [
        {
          id: 'item-3',
          productId: 'prod-002',
          name: 'اشتراك نظام سحابي سنوي (SaaS)',
          quantity: 1,
          unitPrice: 2400,
          vatRate: 15,
          subtotal: 2400,
          vatAmount: 360,
          total: 2760,
        },
      ],
      subtotal: inv2Subtotal,
      discount: 0,
      taxableAmount: inv2Subtotal,
      vatTotal: inv2Vat,
      grandTotal: inv2Grand,
      notes: 'فاتورة ضريبية مبسطة نقدية',
      qrCode: inv2Qr,
      createdAt: inv2Date,
    },
    {
      id: 'inv-003',
      invoiceNumber: 'INV-2026-0003',
      sequenceNumber: 3,
      issueDate: inv3Date,
      dueDate: '2026-09-22',
      type: 'simplified',
      status: 'draft',
      customer: initialDemoCustomers[2],
      items: [
        {
          id: 'item-4',
          productId: 'prod-003',
          name: 'استشارات تقنية ودعم فني متخصص',
          quantity: 3,
          unitPrice: 300,
          vatRate: 15,
          subtotal: 900,
          vatAmount: 135,
          total: 1035,
        },
      ],
      subtotal: inv3Subtotal,
      discount: 0,
      taxableAmount: inv3Subtotal,
      vatTotal: inv3Vat,
      grandTotal: inv3Grand,
      notes: 'مسودة قيد المراجعة قبل الإصدار',
      qrCode: inv3Qr,
      createdAt: inv3Date,
    },
  ];
}
