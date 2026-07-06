/**
 * Minimal ABI fragments for the CLOISTRA contracts, shared by the corridor CLI tools.
 * Sealed handles (euint64/ebool) are `bytes32` at the ABI boundary.
 */

export const engineAbi = [
  {
    type: "function",
    name: "mandateToken",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "mandateNonce",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "sealedLimits",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "perTradeCap", type: "bytes32" },
      { name: "totalCap", type: "bytes32" },
      { name: "drawdownPct", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "sealedState",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "spent", type: "bytes32" },
      { name: "custody", type: "bytes32" },
      { name: "highWaterMark", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "amountExt", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const corridorAbi = [
  {
    type: "function",
    name: "mandateId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "sealedCeiling",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "sealedSpent",
    stateMutability: "view",
    inputs: [{ name: "sender", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "setCeiling",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ceilingExt", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "clientNonce", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "amountExt", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const tokenAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
] as const;
