import type { Config } from "../config.js";
import type { PayoutProvider, PayoutRequest, PayoutResult } from "./types.js";

type TokenState = { token: string; expiresAt: number };

/**
 * Flutterwave v4 Direct Transfers adapter. Verified against live docs (VERIFICATION.md §6e):
 *   - Auth: OAuth2 client-credentials — POST {FLW_TOKEN_URL} exchanges Client ID + Secret
 *     for a short-lived bearer token.
 *   - Payout: POST {FLW_BASE_URL}/direct-transfers with `action` + `payment_instruction`.
 * The Client Secret stays server-side and is never logged.
 *
 * NB: the exact `payment_instruction` sub-schema for the chosen rail is the one thing
 * confirmed against the sandbox on the first real call (§6e "Honest status") — the request
 * shape below is the documented v4 envelope with the rail fields marked to confirm.
 */
export class FlutterwaveProvider implements PayoutProvider {
  readonly name = "flutterwave-v4";
  private token: TokenState | null = null;

  constructor(private readonly cfg: Config["flutterwave"]) {}

  /** OAuth2 client-credentials token exchange, cached until ~30s before expiry. */
  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt - 30_000 > now) return this.token.token;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
    });
    const res = await fetch(this.cfg.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Flutterwave token exchange failed: ${res.status} ${await safeText(res)}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return this.token.token;
  }

  async payout(request: PayoutRequest): Promise<PayoutResult> {
    const token = await this.accessToken();
    const b = request.beneficiary;

    const payload = {
      action: "instant",
      reference: request.reference, // idempotency: (corridorId, nonce)
      payment_instruction: {
        amount: { value: request.amount, currency: b.currency },
        // Rail fields — confirm names against the sandbox on first run (§6e).
        recipient: {
          type: b.type,
          bank: b.type === "bank" ? b.network : undefined,
          mobile_money_network: b.type === "mobilemoney" ? b.network : undefined,
          account_number: b.accountNumber,
          account_name: b.accountName,
        },
        narration: request.narration,
      },
    };

    const res = await fetch(`${this.cfg.baseUrl}/direct-transfers`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Flutterwave direct-transfer failed: ${res.status} ${await safeText(res)}`);
    }
    const json = (await res.json()) as {
      id?: string;
      status?: string;
      data?: { id?: string; status?: string };
    };
    return {
      providerId: json.data?.id ?? json.id ?? "unknown",
      status: json.data?.status ?? json.status ?? "pending",
      raw: json,
    };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
