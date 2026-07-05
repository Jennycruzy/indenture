import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getAddress, type Address, type Hex } from "viem";

// Load .env.local (preferred, gitignored secrets) then .env, from the package root — not cwd.
// dotenv gives the first file precedence, so .env.local wins.
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenvConfig({ path: [resolve(pkgDir, ".env.local"), resolve(pkgDir, ".env")] });

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
    /** v3 secret key (FLWSECK_TEST… in sandbox). Server-side only; never logged. */
    secretKey: string;
    /** API base. v3 test mode is keyed by the FLWSECK_TEST secret — no separate host. */
    baseUrl: string;
    /**
     * Sandbox-only suffix appended to the payout reference to drive Flutterwave's mock disburse
     * callback (e.g. `_PMCKDU_1` → SUCCESSFUL after ~1 min; `_PMCK_ST_FDU_1` → FAILED). Without it,
     * test transfers stay PENDING indefinitely. Leave empty in production.
     */
    referenceSuffix: string;
  };
  beneficiariesJson: string | undefined;
};

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "")
    throw new Error(`Missing required env ${name} (see packages/offramp/.env.example)`);
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
      secretKey: req("FLW_SECRET_KEY"),
      baseUrl: opt("FLW_BASE_URL", "https://api.flutterwave.com/v3"),
      referenceSuffix: opt("FLW_TEST_REFERENCE_SUFFIX", ""),
    },
    beneficiariesJson: process.env.BENEFICIARIES_JSON,
  };
}
