import { loadConfig } from "./config.js";
import { ZamaOfficerDecryptor } from "./officer.js";
import { FlutterwaveProvider } from "./providers/flutterwave.js";
import { loadBeneficiaries } from "./beneficiary.js";
import { runListener } from "./listener.js";

async function main(): Promise<void> {
  const cfg = loadConfig();

  // Hard stop: this off-ramp edge is a SANDBOX demonstration by design (VERIFICATION.md §6e).
  if (cfg.flutterwave.live) {
    throw new Error("FLW_LIVE=true refused — the off-ramp edge is sandbox-only by design (VERIFICATION.md §6e).");
  }

  const decryptor = new ZamaOfficerDecryptor(cfg);
  const provider = new FlutterwaveProvider(cfg.flutterwave);
  const beneficiaries = loadBeneficiaries(cfg.beneficiariesJson);

  await runListener({ cfg, decryptor, provider, beneficiaries });
}

main().catch(err => {
  console.error("[offramp] fatal:", err);
  process.exit(1);
});
