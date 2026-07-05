"use client";

import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * A CLOISTRA corridor is deployed per-mandate. We persist ONLY the active corridor's
 * address (+ an optional label) locally; every role and policy fact — operator,
 * compliance officer, engine, mandate id, window, nonce, sealed handles — is read
 * from chain off that address. Nothing about the sealed policy is cached client-side.
 */
export type ActiveCorridor = {
  address: Address;
  label?: string;
};

type CloistraState = {
  active?: ActiveCorridor;
  /** The scout's-eye toggle — render the corridor as an outside on-chain observer sees it. */
  scoutMode: boolean;
  setActive: (c?: ActiveCorridor) => void;
  toggleScout: () => void;
  setScout: (v: boolean) => void;
};

export const useCloistraStore = create<CloistraState>()(
  persist(
    set => ({
      active: undefined,
      scoutMode: false,
      setActive: active => set({ active }),
      toggleScout: () => set(s => ({ scoutMode: !s.scoutMode })),
      setScout: v => set({ scoutMode: v }),
    }),
    { name: "cloistra-active-corridor" },
  ),
);

/** Matches the Corridor's rolling `window` (30 days). Public — block time is not secret. */
export const WINDOW_SECONDS = 30n * 24n * 60n * 60n;
