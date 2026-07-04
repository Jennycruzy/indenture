import { getAddress, type Address } from "viem";
import type { Beneficiary } from "./providers/types.js";

/**
 * Resolve an on-chain recipient address to a KYC'd fiat beneficiary. The recipient
 * address is public on-chain; the fiat destination is held OFF-chain by the operator.
 */
export interface BeneficiaryResolver {
  resolve(recipient: Address): Promise<Beneficiary | undefined>;
}

/** Minimal in-memory resolver for the sandbox demo. Replace with the operator's KYC store. */
export class StaticBeneficiaryResolver implements BeneficiaryResolver {
  private readonly map: Map<string, Beneficiary>;
  constructor(map: Record<string, Beneficiary>) {
    this.map = new Map(Object.entries(map).map(([k, v]) => [getAddress(k as Address), v]));
  }
  async resolve(recipient: Address): Promise<Beneficiary | undefined> {
    return this.map.get(getAddress(recipient));
  }
}

export function loadBeneficiaries(json: string | undefined): StaticBeneficiaryResolver {
  if (!json || json.trim() === "") return new StaticBeneficiaryResolver({});
  return new StaticBeneficiaryResolver(JSON.parse(json) as Record<string, Beneficiary>);
}
