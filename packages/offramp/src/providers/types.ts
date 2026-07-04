/** A fiat beneficiary resolved from an on-chain recipient address. */
export type Beneficiary = {
  /** ISO-4217 currency to pay out in, e.g. "NGN". */
  currency: string;
  /** Destination rail. */
  type: "bank" | "mobilemoney";
  /** Bank code (bank) or mobile-money network id (momo) — provider-specific. */
  network: string;
  /** Account number (bank) or phone number (momo). */
  accountNumber: string;
  accountName?: string;
};

/** The instruction to pay out one cleared corridor transfer. */
export type PayoutRequest = {
  /** Idempotency key — bound to (corridorId, nonce) so a replay never double-pays. */
  reference: string;
  /** Local-currency amount to disburse (already FX/decimal-mapped from `moved`). */
  amount: string;
  beneficiary: Beneficiary;
  /** Audit narration — MUST NOT contain any sealed value. */
  narration: string;
};

export type PayoutResult = {
  /** Provider-side reference id — recorded in DEPLOYMENTS.md Gate C2 as evidence. */
  providerId: string;
  status: string;
  raw: unknown;
};

/**
 * The typed provider-adapter seam. Swapping PSPs (Flutterwave <-> any other) is
 * implementing this one interface — the listener and the officer-decrypt gate never change.
 */
export interface PayoutProvider {
  readonly name: string;
  payout(request: PayoutRequest): Promise<PayoutResult>;
}
