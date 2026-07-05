"use client";

import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper";

/** Renders children only once a wallet is connected; otherwise a connect prompt in the
 *  obsidian language. Every CLOISTRA action is a signed, wallet-approved transaction. */
export function ConnectGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (isConnected) return <>{children}</>;
  return (
    <div className="ob-card p-10 text-center flex flex-col items-center gap-4">
      <div className="ob-seal-text ob-display text-xl font-bold">Connect to the corridor</div>
      <p className="text-sm max-w-md" style={{ color: "var(--ob-ink-dim)" }}>
        Every action here is a wallet-approved transaction that fires the real FHEVM path — client-side encryption,
        input-proof verification, and (for the compliance officer) EIP-712 user-decryption.
      </p>
      <RainbowKitCustomConnectButton />
    </div>
  );
}
