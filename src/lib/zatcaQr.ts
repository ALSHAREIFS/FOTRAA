/**
 * ZATCA (Fatoora) Phase 1 QR Code TLV (Tag-Length-Value) Base64 Generator & Parser
 * Compliant with the Saudi Zakat, Tax and Customs Authority (ZATCA) electronic invoicing specifications.
 */

export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601 string, e.g. "2026-09-19T14:30:00Z"
  totalWithVat: string | number; // formatted as "115.00"
  vatTotal: string | number; // formatted as "15.00"
}

export interface DecodedZatcaQr {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatTotal: number;
  isValid: boolean;
  errors?: string[];
}

/**
 * Validates a Saudi 15-digit VAT Number
 * Must be 15 digits, numeric only, starting with 3 and ending with 3.
 */
export function validateSaudiVatNumber(vat: string): { isValid: boolean; error?: string } {
  const cleaned = vat.trim();
  if (!cleaned) {
    return { isValid: false, error: 'الرقم الضريبي مطلوب' };
  }
  if (!/^\d{15}$/.test(cleaned)) {
    return { isValid: false, error: 'الرقم الضريبي يجب أن يتكون من 15 رقم بالتمام' };
  }
  if (!cleaned.startsWith('3')) {
    return { isValid: false, error: 'الرقم الضريبي في المملكة يجب أن يبدأ بالرقم 3' };
  }
  if (!cleaned.endsWith('3')) {
    return { isValid: false, error: 'الرقم الضريبي في المملكة يجب أن ينتهي بالرقم 3' };
  }
  return { isValid: true };
}

/**
 * Encodes a single TLV element into Uint8Array bytes
 * Tag: 1 byte
 * Length: 1 byte (length of UTF-8 encoded value)
 * Value: UTF-8 encoded bytes
 */
function encodeTlvElement(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const length = valueBytes.length;

  const tlvBytes = new Uint8Array(2 + length);
  tlvBytes[0] = tag;
  tlvBytes[1] = length;
  tlvBytes.set(valueBytes, 2);

  return tlvBytes;
}

/**
 * Generates the ZATCA compliant TLV Base64 QR Code string
 */
export function generateZatcaQRTLV(fields: ZatcaQrFields): string {
  const formattedTotal = typeof fields.totalWithVat === 'number' 
    ? fields.totalWithVat.toFixed(2) 
    : parseFloat(fields.totalWithVat).toFixed(2);
    
  const formattedVat = typeof fields.vatTotal === 'number' 
    ? fields.vatTotal.toFixed(2) 
    : parseFloat(fields.vatTotal).toFixed(2);

  const tag1 = encodeTlvElement(1, fields.sellerName.trim());
  const tag2 = encodeTlvElement(2, fields.vatNumber.trim());
  const tag3 = encodeTlvElement(3, fields.timestamp.trim());
  const tag4 = encodeTlvElement(4, formattedTotal);
  const tag5 = encodeTlvElement(5, formattedVat);

  const totalLength = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const tag of [tag1, tag2, tag3, tag4, tag5]) {
    combined.set(tag, offset);
    offset += tag.length;
  }

  // Convert Uint8Array to binary string, then to Base64
  let binaryString = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binaryString += String.fromCharCode(combined[i]);
  }

  return btoa(binaryString);
}

/**
 * Decodes and verifies a ZATCA TLV Base64 string back into human readable fields
 */
export function decodeZatcaQRTLV(base64Str: string): DecodedZatcaQr {
  try {
    const binaryString = atob(base64Str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decoder = new TextDecoder('utf-8');
    let offset = 0;
    const tags: Record<number, string> = {};

    while (offset < bytes.length) {
      const tag = bytes[offset];
      const length = bytes[offset + 1];
      const valueBytes = bytes.slice(offset + 2, offset + 2 + length);
      tags[tag] = decoder.decode(valueBytes);
      offset += 2 + length;
    }

    const sellerName = tags[1] || '';
    const vatNumber = tags[2] || '';
    const timestamp = tags[3] || '';
    const totalWithVat = parseFloat(tags[4] || '0');
    const vatTotal = parseFloat(tags[5] || '0');

    const errors: string[] = [];
    if (!sellerName) errors.push('اسم البائع مفقود في QR');
    if (!vatNumber) errors.push('الرقم الضريبي مفقود في QR');
    if (!timestamp) errors.push('التاريخ والوقت مفقود في QR');
    if (isNaN(totalWithVat) || totalWithVat <= 0) errors.push('المبلغ الإجمالي غير صالح');
    if (isNaN(vatTotal) || vatTotal < 0) errors.push('مبلغ الضريبة غير صالح');

    return {
      sellerName,
      vatNumber,
      timestamp,
      totalWithVat,
      vatTotal,
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: any) {
    return {
      sellerName: '',
      vatNumber: '',
      timestamp: '',
      totalWithVat: 0,
      vatTotal: 0,
      isValid: false,
      errors: ['فشل فك تشفير TLV Base64: ' + (err.message || 'بيانات تالفة')],
    };
  }
}
