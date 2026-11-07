import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditEntry, canPerformWorkspaceAction } from '../src/lib/rbac.ts';

test('RBAC enforces strict separation between owner, AI manager, viewer, and resident roles', () => {
  // Owner can approve drafts, mutate records, and read audit logs
  assert.equal(canPerformWorkspaceAction('owner', 'draft.approve'), true);
  assert.equal(canPerformWorkspaceAction('owner', 'record.mutate'), true);
  assert.equal(canPerformWorkspaceAction('owner', 'audit.read'), true);

  // Manager (dedicated AI employee account) can read portfolio and create drafts, but NEVER approve drafts or mutate live records
  assert.equal(canPerformWorkspaceAction('manager', 'portfolio.read'), true);
  assert.equal(canPerformWorkspaceAction('manager', 'draft.create'), true);
  assert.equal(canPerformWorkspaceAction('manager', 'draft.approve'), false);
  assert.equal(canPerformWorkspaceAction('manager', 'record.mutate'), false);

  // Viewer is strictly read-only
  assert.equal(canPerformWorkspaceAction('viewer', 'portfolio.read'), true);
  assert.equal(canPerformWorkspaceAction('viewer', 'draft.create'), false);

  // Resident can only read own lease and report faults
  assert.equal(canPerformWorkspaceAction('resident', 'resident.report_fault'), true);
  assert.equal(canPerformWorkspaceAction('resident', 'portfolio.read'), false);
});

test('buildAuditEntry creates immutable audit records and blocks direct mutations by manager/viewer', () => {
  const entry = buildAuditEntry({
    workspaceId: 'ws-fict-01',
    actorId: 'owner-uuid-1',
    actorRole: 'owner',
    tableName: 'certificates',
    recordId: 'cert-fict-102',
    action: 'UPDATE',
    beforeData: { expires_on: '2026-11-18' },
    afterData: { expires_on: '2031-11-18' },
    timestampIso: '2026-11-09T09:00:00Z'
  });

  assert.equal(entry.action, 'UPDATE');
  assert.throws(() => {
    // @ts-expect-error frozen object
    entry.action = 'DELETE';
  });

  assert.throws(
    () =>
      buildAuditEntry({
        workspaceId: 'ws-fict-01',
        actorId: 'mgr-uuid-1',
        actorRole: 'manager',
        tableName: 'rent_payments',
        recordId: 'pay-fict-301',
        action: 'UPDATE',
        beforeData: { paid_at: null },
        afterData: { paid_at: '2026-11-09' }
      }),
    /not permitted to mutate table/
  );
});
