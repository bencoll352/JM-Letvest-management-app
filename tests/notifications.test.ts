import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyNotifications } from '../src/lib/notifications.ts';

test('buildDailyNotifications flags certificates expired or expiring within 30 days and unpaid overdue rent', () => {
  const notifications = buildDailyNotifications({
    referenceDate: '2026-11-09',
    properties: [
      {
        id: 'prop-fict-01',
        address: '14 Albion Terrace, M14 5AA',
        certificates: {
          CP12: '2027-05-01',
          EICR: '2026-11-18',
          'HMO Licence': '2026-11-01'
        }
      }
    ],
    payments: [
      {
        id: 'pay-fict-301',
        propertyId: 'prop-fict-01',
        room: 'Room 2',
        due: '2026-10-20',
        amount: 650,
        paid: false
      },
      {
        id: 'pay-fict-302',
        propertyId: 'prop-fict-01',
        room: 'Room 3',
        due: '2026-11-01',
        amount: 650,
        paid: true
      }
    ]
  });

  assert.equal(notifications.length, 3);
  const expiredHmo = notifications.find(n => n.recordId === 'prop-fict-01:HMO Licence');
  assert.ok(expiredHmo);
  assert.equal(expiredHmo.severity, 'critical');
  assert.equal(expiredHmo.checkWithSolicitor, true);

  const expiringEicr = notifications.find(n => n.recordId === 'prop-fict-01:EICR');
  assert.ok(expiringEicr);
  assert.equal(expiringEicr.severity, 'warning');

  const overdueRent = notifications.find(n => n.recordId === 'pay-fict-301');
  assert.ok(overdueRent);
  assert.equal(overdueRent.severity, 'critical');
  assert.equal(overdueRent.checkWithSolicitor, true);
});
