export type BankTransaction = {
  id: string;
  provider: 'gocardless' | 'open_banking';
  externalTxId: string;
  bookedOn: string;
  amount: number;
  reference: string;
};

export type RentPaymentCandidate = {
  id: string;
  propertyId: string;
  room: string;
  dueOn: string;
  amount: number;
  paid: boolean;
  expectedReference?: string;
};

export type ProposedBankMatch = {
  transactionId: string;
  paymentId: string | null;
  status: 'proposed_match' | 'unmatched';
  confidence: 'exact_reference_and_amount' | 'room_and_amount' | 'none';
  requiresHumanConfirmation: true;
};

export function isBankFeedEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_ENABLE_BANK_FEED === 'true';
}

function normalizeRef(value: string): string {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function matchBankFeedTransactions(
  transactions: BankTransaction[],
  payments: RentPaymentCandidate[],
  env: Record<string, string | undefined> = process.env
): {
  enabled: boolean;
  matches: ProposedBankMatch[];
} {
  if (!isBankFeedEnabled(env)) {
    return { enabled: false, matches: [] };
  }

  const unpaid = payments.filter(p => !p.paid);
  const usedPaymentIds = new Set<string>();

  const matches: ProposedBankMatch[] = transactions.map(tx => {
    const normTxRef = normalizeRef(tx.reference);

    // 1. Exact payment ID or expectedReference + exact amount match
    const exact = unpaid.find(
      p =>
        !usedPaymentIds.has(p.id) &&
        Number(p.amount) === Number(tx.amount) &&
        ((p.expectedReference && normTxRef.includes(normalizeRef(p.expectedReference))) ||
          normTxRef.includes(normalizeRef(p.id)))
    );
    if (exact) {
      usedPaymentIds.add(exact.id);
      return {
        transactionId: tx.id,
        paymentId: exact.id,
        status: 'proposed_match',
        confidence: 'exact_reference_and_amount',
        requiresHumanConfirmation: true
      };
    }

    // 2. Room name + property ID token + exact amount match
    const roomMatch = unpaid.find(
      p =>
        !usedPaymentIds.has(p.id) &&
        Number(p.amount) === Number(tx.amount) &&
        normTxRef.includes(normalizeRef(p.room)) &&
        normTxRef.includes(normalizeRef(p.propertyId))
    );
    if (roomMatch) {
      usedPaymentIds.add(roomMatch.id);
      return {
        transactionId: tx.id,
        paymentId: roomMatch.id,
        status: 'proposed_match',
        confidence: 'room_and_amount',
        requiresHumanConfirmation: true
      };
    }

    return {
      transactionId: tx.id,
      paymentId: null,
      status: 'unmatched',
      confidence: 'none',
      requiresHumanConfirmation: true
    };
  });

  return { enabled: true, matches };
}
