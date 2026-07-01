#!/usr/bin/env bash
# Deploy the shared INDENTURE backbone (engine + demo cToken + ConfidentialFeed) to Sepolia.
#
# The per-mandate consumers (Leash, SealedSettlement) are deployed from the frontend, where the
# principal generates the client-side encrypted mandate inputs via the SDK.
#
# Required env vars:
#   SEPOLIA_RPC_URL       - Sepolia JSON-RPC endpoint
#   DEPLOYER_PRIVATE_KEY  - private key of the deployer (0x-prefixed); the script self-broadcasts
#
# Optional env vars:
#   FEED_PUBLISHER        - address allowed to post feed values (defaults to the deployer)
#   ETHERSCAN_API_KEY     - if set, verifies the contracts on Etherscan
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOUNDRY_DIR="$REPO_ROOT/packages/foundry"

# Auto-load repo-root .env.local if present, so users don't have to source it.
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.local"
  set +a
fi

: "${SEPOLIA_RPC_URL:?SEPOLIA_RPC_URL is required (set in .env.local or shell)}"
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required (set in .env.local or shell)}"

# The Solidity script reads DEPLOYER_PRIVATE_KEY from env and self-broadcasts, so we do NOT pass
# --private-key here (that would double-set the signer).
FORGE_ARGS=(
  script/DeployIndenture.s.sol:DeployIndenture
  --rpc-url "$SEPOLIA_RPC_URL"
  --broadcast
)

if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
  FORGE_ARGS+=(--verify --etherscan-api-key "$ETHERSCAN_API_KEY")
else
  echo "note: ETHERSCAN_API_KEY not set — skipping verification"
fi

cd "$FOUNDRY_DIR"
forge script "${FORGE_ARGS[@]}"

echo
echo "✅  INDENTURE backbone deployed to Sepolia."
echo "    Copy the logged addresses + broadcast tx hashes into DEPLOYMENTS.md."
