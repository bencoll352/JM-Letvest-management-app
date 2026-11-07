export const PROPERTY_DOCUMENTS_BUCKET = 'property-documents';
export const MAX_DOCUMENT_BYTES = 10_485_760; // 10 MB

export const DOCUMENT_CATEGORIES = ['certificate', 'master_lease', 'sub_lease', 'inventory'] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_SUBTYPES = [
  'CP12',
  'EICR',
  'PAT',
  'EPC',
  'HMO Licence',
  'Head Lease',
  'Room Agreement',
  'Check-In Inventory',
  'Check-Out Inventory'
] as const;
export type DocumentSubtype = (typeof DOCUMENT_SUBTYPES)[number];

export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type DocumentUploadInput = {
  workspaceId: string;
  propertyId: string;
  category: DocumentCategory;
  subtype: DocumentSubtype;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn?: string | null;
};

export function validateDocumentUpload(input: DocumentUploadInput): {
  valid: boolean;
  error?: string;
  storagePath?: string;
} {
  if (!input.workspaceId?.trim() || !input.propertyId?.trim() || !input.fileName?.trim()) {
    return { valid: false, error: 'workspaceId, propertyId, and fileName are required' };
  }
  if (!DOCUMENT_CATEGORIES.includes(input.category)) {
    return { valid: false, error: `Unsupported document category: ${input.category}` };
  }
  if (!DOCUMENT_SUBTYPES.includes(input.subtype)) {
    return { valid: false, error: `Unsupported document subtype: ${input.subtype}` };
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    return { valid: false, error: `Unsupported MIME type: ${input.mimeType}` };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_DOCUMENT_BYTES) {
    return { valid: false, error: `Document size must be between 1 byte and 10 MB (${MAX_DOCUMENT_BYTES} bytes)` };
  }
  if (input.category === 'certificate' && !input.expiresOn) {
    return { valid: false, error: 'Compliance certificate uploads require an expiresOn date' };
  }

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeSubtype = input.subtype.toLowerCase().replace(/\s+/g, '-');
  const storagePath = `${input.workspaceId}/${input.propertyId}/${input.category}/${safeSubtype}/${safeName}`;
  return { valid: true, storagePath };
}
