import type { WalletList } from "@rainbow-me/rainbowkit";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import scaffoldConfig from "~~/scaffold.config";
import { hardhat } from "~~/services/web3/chains";

const { onlyLocalBurnerWallet, targetNetworks } = scaffoldConfig;

const wallets: WalletList[number]["wallets"] = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  coinbaseWallet,
  rainbowWallet,
  safeWallet,
  ...(!targetNetworks.some(network => network.id !== hardhat.id) || !onlyLocalBurnerWallet
    ? [rainbowkitBurnerWallet as any]
    : []),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  // TODO: update when https://github.com/rainbow-me/rainbowkit/issues/2476 is resolved
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        groupName: "Supported Wallets",
        wallets,
      },
    ],

    {
      appName: "helper-2",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
