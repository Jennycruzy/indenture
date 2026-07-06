import type { Chain } from "viem";
import scaffoldConfig from "~~/scaffold.config";
import { appChains, hardhat, mainnet, sepolia } from "~~/services/web3/chains";

type ChainAttributes = {
  // color | [lightThemeColor, darkThemeColor]
  color: string | [string, string];
  // Used to fetch price by providing mainnet token address
  // for networks having native currency other than ETH
  nativeCurrencyTokenAddress?: string;
};

export type ChainWithAttributes = Chain & Partial<ChainAttributes>;
export type AllowedChainIds = (typeof scaffoldConfig.targetNetworks)[number]["id"];

// Mapping of chainId to RPC chain name an format followed by alchemy and infura
export const RPC_CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: "eth-mainnet",
  [sepolia.id]: "eth-sepolia",
};

export const getAlchemyHttpUrl = (chainId: number) => {
  return scaffoldConfig.alchemyApiKey && RPC_CHAIN_NAMES[chainId]
    ? `https://${RPC_CHAIN_NAMES[chainId]}.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`
    : undefined;
};

export const NETWORKS_EXTRA_DATA: Record<string, ChainAttributes> = {
  [hardhat.id]: {
    color: "#b8af0c",
  },
  [mainnet.id]: {
    color: "#ff8b9e",
  },
  [sepolia.id]: {
    color: ["#5f4bb6", "#87ff65"],
  },
};

/**
 * Gives the block explorer transaction URL, returns empty string if the network is a local chain
 */
export function getBlockExplorerTxLink(chainId: number, txnHash: string) {
  const blockExplorerTxURL = appChains.find(chain => chain.id === chainId)?.blockExplorers?.default?.url;

  if (!blockExplorerTxURL) {
    return "";
  }

  return `${blockExplorerTxURL}/tx/${txnHash}`;
}

/**
 * Gives the block explorer URL for a given address.
 * Defaults to Etherscan if no (wagmi) block explorer is configured for the network.
 */
export function getBlockExplorerAddressLink(network: Chain, address: string) {
  const blockExplorerBaseURL = network.blockExplorers?.default?.url;
  if (network.id === hardhat.id) {
    return `/blockexplorer/address/${address}`;
  }

  if (!blockExplorerBaseURL) {
    return `https://etherscan.io/address/${address}`;
  }

  return `${blockExplorerBaseURL}/address/${address}`;
}

/**
 * @returns targetNetworks array containing networks configured in scaffold.config including extra network metadata
 */
export function getTargetNetworks(): ChainWithAttributes[] {
  return scaffoldConfig.targetNetworks.map(targetNetwork => ({
    ...targetNetwork,
    ...NETWORKS_EXTRA_DATA[targetNetwork.id],
  }));
}
