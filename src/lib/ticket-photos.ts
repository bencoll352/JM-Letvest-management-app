export const TICKET_PHOTO_BUCKET = 'ticket-photos';
export const MAX_TICKET_PHOTO_BYTES = 1_572_864; // 1.5 MB
export const ALLOWED_TICKET_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type TicketPhotoUploadCandidate = {
  workspaceId: string;
  ticketId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export function validateTicketPhotoUpload(candidate: TicketPhotoUploadCandidate): {
  valid: boolean;
  error?: string;
  storagePath?: string;
} {
  if (!candidate.workspaceId?.trim() || !candidate.ticketId?.trim()) {
    return { valid: false, error: 'Workspace ID and ticket ID are required' };
  }
  if (candidate.fileName.startsWith('data:image/')) {
    return { valid: false, error: 'Inline base64 data URLs are forbidden; upload binary file to private bucket' };
  }
  if (!ALLOWED_TICKET_PHOTO_MIME_TYPES.includes(candidate.mimeType as (typeof ALLOWED_TICKET_PHOTO_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `Unsupported photo MIME type "${candidate.mimeType}". Allowed: ${ALLOWED_TICKET_PHOTO_MIME_TYPES.join(', ')}`
    };
  }
  if (!Number.isFinite(candidate.sizeBytes) || candidate.sizeBytes <= 0) {
    return { valid: false, error: 'Photo file size must be greater than 0 bytes' };
  }
  if (candidate.sizeBytes > MAX_TICKET_PHOTO_BYTES) {
    return {
      valid: false,
      error: `Photo size (${candidate.sizeBytes} bytes) exceeds the 1.5 MB (${MAX_TICKET_PHOTO_BYTES} bytes) limit`
    };
  }

  const safeFile = candidate.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${candidate.workspaceId}/${candidate.ticketId}/${safeFile}`;
  return { valid: true, storagePath };
}
