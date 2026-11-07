export type OperationalNotification = {
  id: string;
  kind: 'certificate_expiry' | 'rent_arrears';
  severity: 'critical' | 'warning';
  recordId: string;
  title: string;
  message: string;
  checkWithSolicitor: boolean;
  daysDelta: number;
};

function daysBetween(targetIso: string, refIso: string): number {
  const target = Date.parse(`${targetIso}T00:00:00Z`);
  const ref = Date.parse(`${refIso}T00:00:00Z`);
  return Math.round((target - ref) / 86400000);
}

export function buildDailyNotifications(input: {
  referenceDate: string;
  properties: Array<{
    id: string;
    address: string;
    certificates: Record<string, string>;
  }>;
  payments: Array<{
    id: string;
    propertyId: string;
    room: string;
    due: string;
    amount: number;
    paid: boolean;
  }>;
}): OperationalNotification[] {
  const results: OperationalNotification[] = [];
  const { referenceDate, properties, payments } = input;

  for (const prop of properties) {
    for (const [kind, expiry] of Object.entries(prop.certificates || {})) {
      if (!expiry) continue;
      const daysRemaining = daysBetween(expiry, referenceDate);
      if (daysRemaining <= 30) {
        const expired = daysRemaining < 0;
        results.push({
          id: `notif-cert-${prop.id}-${kind}-${referenceDate}`,
          kind: 'certificate_expiry',
          severity: expired ? 'critical' : 'warning',
          recordId: `${prop.id}:${kind}`,
          title: `${kind} ${expired ? 'EXPIRED' : 'expiring within 30 days'} at ${prop.address}`,
          message: `Certificate ${kind} for ${prop.address} expires on ${expiry} (${daysRemaining} days remaining).`,
          checkWithSolicitor: expired || kind === 'HMO Licence',
          daysDelta: daysRemaining
        });
      }
    }
  }

  for (const p of payments) {
    if (p.paid || !p.due) continue;
    const delta = daysBetween(p.due, referenceDate);
    if (delta < 0) {
      const daysOverdue = Math.abs(delta);
      results.push({
        id: `notif-rent-${p.id}-${referenceDate}`,
        kind: 'rent_arrears',
        severity: daysOverdue >= 14 ? 'critical' : 'warning',
        recordId: p.id,
        title: `Overdue rent (£${p.amount}) — ${p.room}`,
        message: `Rent payment ${p.id} (£${p.amount}) due on ${p.due} is ${daysOverdue} days overdue. [CHECK WITH A SOLICITOR]`,
        checkWithSolicitor: true,
        daysDelta: -daysOverdue
      });
    }
  }

  return results;
}
