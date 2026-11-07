import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManagerInvitation,
  validateRoomAgreementAndDeposit
} from '../src/lib/admin-management.ts';

test('validateRoomAgreementAndDeposit enforces head-lease date bounds, deposit references, and solicitor flag', () => {
  const validDps = validateRoomAgreementAndDeposit({
    roomId: 'rm-fict-01',
    masterLeaseId: 'ml-fict-01',
    occupantId: 'c-fict-201',
    monthlyRent: 650,
    startsOn: '2026-11-01',
    endsOn: '2027-05-01',
    masterLeaseStartsOn: '2026-01-01',
    masterLeaseEndsOn: '2029-01-01',
    agreementType: 'AST room-only',
    depositScheme: 'DPS',
    depositReference: 'DPS-99887766'
  });
  assert.equal(validDps.valid, true);
  assert.equal(validDps.checkWithSolicitor, true);

  const missingDepositRef = validateRoomAgreementAndDeposit({
    roomId: 'rm-fict-01',
    masterLeaseId: 'ml-fict-01',
    occupantId: 'c-fict-201',
    monthlyRent: 650,
    startsOn: '2026-11-01',
    endsOn: '2027-05-01',
    masterLeaseStartsOn: '2026-01-01',
    masterLeaseEndsOn: '2029-01-01',
    agreementType: 'AST room-only',
    depositScheme: 'TDS',
    depositReference: ''
  });
  assert.equal(missingDepositRef.valid, false);
  assert.match(missingDepositRef.error || '', /requires a valid certificate\/protection reference/);

  const exceedsHeadLease = validateRoomAgreementAndDeposit({
    roomId: 'rm-fict-01',
    masterLeaseId: 'ml-fict-01',
    occupantId: 'c-fict-201',
    monthlyRent: 650,
    startsOn: '2026-11-01',
    endsOn: '2030-05-01',
    masterLeaseStartsOn: '2026-01-01',
    masterLeaseEndsOn: '2029-01-01',
    agreementType: 'AST room-only',
    depositScheme: 'Not applicable'
  });
  assert.equal(exceedsHeadLease.valid, false);
});

test('validateManagerInvitation restricts invitations to manager or viewer roles with valid email', () => {
  assert.equal(validateManagerInvitation({ email: 'ops.manager@example.test', role: 'manager' }).valid, true);
  assert.equal(validateManagerInvitation({ email: 'bad-email', role: 'manager' }).valid, false);
  assert.equal(validateManagerInvitation({ email: 'ops@example.test', role: 'service_role' }).valid, false);
});
