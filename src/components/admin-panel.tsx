'use client';

import React, { useState } from 'react';
import {
  DEPOSIT_SCHEMES,
  type DepositScheme,
  validateManagerInvitation,
  validateRoomAgreementAndDeposit
} from '../lib/admin-management';

export function AdminPanel() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager');
  const [depositScheme, setDepositScheme] = useState<DepositScheme>('DPS');
  const [depositRef, setDepositRef] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateManagerInvitation({ email: inviteEmail, role: inviteRole });
    setStatusMessage(res.valid ? `Ready to invite ${inviteEmail} as ${inviteRole} (RLS-scoped)` : res.error || 'Invalid');
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Portfolio Administration & Governance</h2>
      <p className="mt-1 text-sm text-slate-600">
        Manage contacts, room agreements, deposit protection references (DPS / TDS / MyDeposits), monthly expense budgets, and RLS-scoped manager invitations.
      </p>
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>[CHECK WITH A SOLICITOR]</strong> Any changes to room agreements, deposit protection schemes, or tenancy terms require owner approval and legal verification.
      </div>
      <form onSubmit={handleCheckInvite} className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="email"
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
          placeholder="ai-manager@example.test"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={inviteRole}
          onChange={e => setInviteRole(e.target.value as 'manager' | 'viewer')}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="manager">Manager (Read + Queue Drafts)</option>
          <option value="viewer">Viewer (Read Only)</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Stage Manager Invite
        </button>
      </form>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          value={depositScheme}
          onChange={e => setDepositScheme(e.target.value as DepositScheme)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {DEPOSIT_SCHEMES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={depositRef}
          onChange={e => setDepositRef(e.target.value)}
          placeholder="Deposit protection certificate reference"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {statusMessage && <p className="mt-3 text-xs font-medium text-slate-700">{statusMessage}</p>}
    </section>
  );
}
