import type { Config } from "../config.js";
import type { PayoutProvider, PayoutRequest, PayoutResult } from "./types.js";

/**
 * Flutterwave v3 Transfers adapter. Verified against the live sandbox (VERIFICATION.md §6e):
 *   - Auth: static `Authorization: Bearer <secret key>`. Test mode is keyed by the FLWSECK_TEST
 *     secret itself — there is NO separate sandbox host (base stays api.flutterwave.com/v3).
 *     Confirmed: GET /v3/transfers → HTTP 200 with the test key; GET /v3/banks/NG → real NG codes.
 *   - Payout: POST /v3/transfers.
 * The secret key stays server-side and is never logged.
 */
export class FlutterwaveProvider implements PayoutProvider {
  readonly name = "flutterwave-v3";

  constructor(private readonly cfg: Config["flutterwave"]) {}

  async payout(request: PayoutRequest): Promise<PayoutResult> {
    const b = request.beneficiary;

    // v3 transfers: `account_bank` is a bank code (NG) or MoMo network code; `account_number`
    // is the bank account (or the phone for MoMo). Codes come from GET /v3/banks/NG.
    const payload = {
      account_bank: b.network,
      account_number: b.accountNumber,
      amount: Number(request.amount),
      currency: b.currency,
      debit_currency: b.currency,
      narration: request.narration,
      reference: request.reference, // idempotency: (corridorId, nonce)
    };

    const res = await fetch(`${this.cfg.baseUrl}/transfers`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.cfg.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      data?: { id?: number; status?: string; reference?: string };
    };
    if (!res.ok || json.status !== "success") {
      throw new Error(
        `Flutterwave v3 transfer failed: ${res.status} ${json.message ?? JSON.stringify(json)}`,
      );
    }
    return {
      providerId: json.data?.id != null ? String(json.data.id) : "unknown",
      status: json.data?.status ?? "NEW",
      raw: json,
    };
  }
}
