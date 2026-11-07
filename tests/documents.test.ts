import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentUpload } from '../src/lib/documents.ts';

test('validateDocumentUpload validates certificates, agreements, and inventories and requires expiry on certificates', () => {
  const certOk = validateDocumentUpload({
    workspaceId: 'ws-fict-01',
    propertyId: 'prop-fict-01',
    category: 'certificate',
    subtype: 'CP12',
    fileName: 'cp12-2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 245_000,
    expiresOn: '2027-11-01'
  });
  assert.equal(certOk.valid, true);
  assert.equal(certOk.storagePath, 'ws-fict-01/prop-fict-01/certificate/cp12/cp12-2026.pdf');

  const certMissingExpiry = validateDocumentUpload({
    workspaceId: 'ws-fict-01',
    propertyId: 'prop-fict-01',
    category: 'certificate',
    subtype: 'EICR',
    fileName: 'eicr.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 245_000
  });
  assert.equal(certMissingExpiry.valid, false);
  assert.match(certMissingExpiry.error || '', /require an expiresOn date/);

  const inventoryOk = validateDocumentUpload({
    workspaceId: 'ws-fict-01',
    propertyId: 'prop-fict-01',
    category: 'inventory',
    subtype: 'Check-In Inventory',
    fileName: 'room-2-checkin.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_200_000
  });
  assert.equal(inventoryOk.valid, true);
});
