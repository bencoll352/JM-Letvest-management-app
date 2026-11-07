'use client';

import React from 'react';
import { isBankFeedEnabled } from '../lib/bank-feed';

export function BankReconciliationBanner() {
  const enabled = isBankFeedEnabled();

  if (!enabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <strong>Bank Feed Matching (Feature Flagged Off):</strong> Set <code>NEXT_PUBLIC_ENABLE_BANK_FEED=true</code> to enable Open Banking / GoCardless draft payment matching.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
      <strong>Bank Feed Matching Active (Draft Proposal Mode):</strong> Incoming Open Banking / GoCardless transactions are matched as <code>proposed_match</code> and require Owner confirmation before marking rent payments as paid.
    </div>
  );
}
