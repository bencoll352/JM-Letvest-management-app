import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TICKET_PHOTO_BYTES, validateTicketPhotoUpload } from '../src/lib/ticket-photos.ts';

test('validateTicketPhotoUpload enforces 1.5 MB limit, MIME allowlist, and rejects base64 data URLs', () => {
  const ok = validateTicketPhotoUpload({
    workspaceId: 'ws-fict-01',
    ticketId: 'tkt-fict-204',
    fileName: 'boiler-gauge.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 420_000
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.storagePath, 'ws-fict-01/tkt-fict-204/boiler-gauge.jpg');

  const tooLarge = validateTicketPhotoUpload({
    workspaceId: 'ws-fict-01',
    ticketId: 'tkt-fict-204',
    fileName: 'raw-4k.png',
    mimeType: 'image/png',
    sizeBytes: MAX_TICKET_PHOTO_BYTES + 1
  });
  assert.equal(tooLarge.valid, false);
  assert.match(tooLarge.error || '', /exceeds the 1\.5 MB/);

  const badMime = validateTicketPhotoUpload({
    workspaceId: 'ws-fict-01',
    ticketId: 'tkt-fict-204',
    fileName: 'script.svg',
    mimeType: 'image/svg+xml',
    sizeBytes: 1024
  });
  assert.equal(badMime.valid, false);

  const inlineBase64 = validateTicketPhotoUpload({
    workspaceId: 'ws-fict-01',
    ticketId: 'tkt-fict-204',
    fileName: 'data:image/png;base64,iVBORw0KGgo=',
    mimeType: 'image/png',
    sizeBytes: 512
  });
  assert.equal(inlineBase64.valid, false);
});
