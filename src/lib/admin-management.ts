export const DEPOSIT_SCHEMES = ['DPS', 'TDS', 'MyDeposits', 'Not applicable'] as const;
export type DepositScheme = (typeof DEPOSIT_SCHEMES)[number];

export type RoomAgreementInput = {
  roomId: string;
  masterLeaseId: string;
  occupantId: string;
  monthlyRent: number;
  startsOn: string;
  endsOn?: string | null;
  masterLeaseStartsOn: string;
  masterLeaseEndsOn: string;
  agreementType: string;
  depositScheme: DepositScheme;
  depositReference?: string | null;
};

export function validateRoomAgreementAndDeposit(input: RoomAgreementInput): {
  valid: boolean;
  checkWithSolicitor: boolean;
  error?: string;
} {
  if (!input.roomId?.trim() || !input.masterLeaseId?.trim() || !input.occupantId?.trim()) {
    return { valid: false, checkWithSolicitor: true, error: 'roomId, masterLeaseId, and occupantId are required' };
  }
  if (!Number.isFinite(input.monthlyRent) || input.monthlyRent <= 0) {
    return { valid: false, checkWithSolicitor: true, error: 'monthlyRent must be greater than £0' };
  }
  if (input.startsOn < input.masterLeaseStartsOn) {
    return {
      valid: false,
      checkWithSolicitor: true,
      error: `Room sub-lease start (${input.startsOn}) cannot precede master head-lease start (${input.masterLeaseStartsOn})`
    };
  }
  if (input.endsOn && input.endsOn > input.masterLeaseEndsOn) {
    return {
      valid: false,
      checkWithSolicitor: true,
      error: `Room sub-lease end (${input.endsOn}) cannot exceed master head-lease end (${input.masterLeaseEndsOn})`
    };
  }
  if (!DEPOSIT_SCHEMES.includes(input.depositScheme)) {
    return { valid: false, checkWithSolicitor: true, error: `Unsupported deposit scheme: ${input.depositScheme}` };
  }
  if (input.depositScheme !== 'Not applicable' && !input.depositReference?.trim()) {
    return {
      valid: false,
      checkWithSolicitor: true,
      error: `Deposit scheme ${input.depositScheme} requires a valid certificate/protection reference`
    };
  }

  return {
    valid: true,
    checkWithSolicitor: true
  };
}

export function validateManagerInvitation(input: { email: string; role: string }): {
  valid: boolean;
  error?: string;
} {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email || '')) {
    return { valid: false, error: 'A valid manager email address is required' };
  }
  if (!['manager', 'viewer'].includes(input.role)) {
    return { valid: false, error: 'Invitation role must be manager or viewer' };
  }
  return { valid: true };
}
