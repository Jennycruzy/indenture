import "dotenv/config";
import { getAddress, type Address, type Hex } from "viem";

/** Typed, validated runtime config. Throws early on any missing required var. */
export type Config = {
  chain: {
    rpcUrl: string;
    engineAddress: Address;
    corridorAddress: Address;
    fromBlock: bigint;
  };
  officer: {
    /** The compliance-officer signer — holds the ACL decrypt grant over `moved`. Server-side only. */
    privateKey: Hex;
  };
  flutterwave: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    baseUrl: string;
    /** Sandbox-only edge by design; index.ts refuses to start when this is true. */
    live: boolean;
  };
  beneficiariesJson: string | undefined;
};

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env ${name} (see packages/offramp/.env.example)`);
  return v.trim();
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

export function loadConfig(): Config {
  const pk = req("OFFICER_PRIVATE_KEY");
  return {
    chain: {
      rpcUrl: req("SEPOLIA_RPC_URL"),
      engineAddress: getAddress(req("ENGINE_ADDRESS")),
      corridorAddress: getAddress(req("CORRIDOR_ADDRESS")),
      fromBlock: BigInt(opt("FROM_BLOCK", "0")),
    },
    officer: { privateKey: (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex },
    flutterwave: {
      clientId: req("FLW_CLIENT_ID"),
      clientSecret: req("FLW_CLIENT_SECRET"),
      tokenUrl: opt("FLW_TOKEN_URL", "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"),
      baseUrl: opt("FLW_BASE_URL", "https://developersandbox-api.flutterwave.com"),
      live: opt("FLW_LIVE", "false") === "true",
    },
    beneficiariesJson: process.env.BENEFICIARIES_JSON,
  };
}
