import test from 'node:test';
import assert from 'node:assert/strict';
import { isBankFeedEnabled, matchBankFeedTransactions } from '../src/lib/bank-feed.ts';

test('bank feed matching stays disabled when feature flag is off and proposes confirmation-gated matches when enabled', () => {
  const txs = [
    {
      id: 'btx-fict-01',
      provider: 'gocardless' as const,
      externalTxId: 'gc-9001',
      bookedOn: '2026-11-02',
      amount: 650,
      reference: 'RENT PAY-FICT-301 ROOM2'
    },
    {
      id: 'btx-fict-02',
      provider: 'open_banking' as const,
      externalTxId: 'ob-9002',
      bookedOn: '2026-11-02',
      amount: 120,
      reference: 'UNKNOWN TRANSFER'
    }
  ];
  const payments = [
    {
      id: 'pay-fict-301',
      propertyId: 'prop-fict-01',
      room: 'Room 2',
      dueOn: '2026-11-01',
      amount: 650,
      paid: false
    }
  ];

  // Disabled by default
  assert.equal(isBankFeedEnabled({}), false);
  const disabledResult = matchBankFeedTransactions(txs, payments, {});
  assert.equal(disabledResult.enabled, false);
  assert.equal(disabledResult.matches.length, 0);

  // Enabled via NEXT_PUBLIC_ENABLE_BANK_FEED=true
  const enabledResult = matchBankFeedTransactions(txs, payments, {
    NEXT_PUBLIC_ENABLE_BANK_FEED: 'true'
  });
  assert.equal(enabledResult.enabled, true);
  assert.equal(enabledResult.matches.length, 2);
  assert.equal(enabledResult.matches[0].status, 'proposed_match');
  assert.equal(enabledResult.matches[0].paymentId, 'pay-fict-301');
  assert.equal(enabledResult.matches[0].requiresHumanConfirmation, true);
  assert.equal(enabledResult.matches[1].status, 'unmatched');
});
