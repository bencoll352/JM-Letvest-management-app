// Supabase Edge Function: daily-notifications
// Evaluates certificate expiries (<= 30 days) and overdue rent payments for the authenticated owner workspace.
// Never sends automatic messages to tenants; writes in-app notification records only.

import { buildDailyNotifications } from '../../../src/lib/notifications.ts';

export async function handleDailyNotificationsRequest(snapshot: {
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
}) {
  const notifications = buildDailyNotifications(snapshot);
  return {
    ok: true,
    referenceDate: snapshot.referenceDate,
    count: notifications.length,
    notifications
  };
}
