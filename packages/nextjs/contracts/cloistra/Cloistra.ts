// AUTO-GENERATED from packages/foundry/out — do not edit by hand.
// Regenerate after a contract change: see scripts/generateTsAbis.ts.

export const cloistraAbi = [
  {
    type: "function",
    name: "commitMandate",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "agent",
        type: "address",
        internalType: "address",
      },
      {
        name: "token",
        type: "address",
        internalType: "contract IERC7984",
      },
      {
        name: "perTradeCapExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "perTradeProof",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "totalCapExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "totalProof",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "drawdownPctExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "drawdownProof",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "commitMandateFor",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "agent",
        type: "address",
        internalType: "address",
      },
      {
        name: "token",
        type: "address",
        internalType: "contract IERC7984",
      },
      {
        name: "complianceOfficer",
        type: "address",
        internalType: "address",
      },
      {
        name: "perTradeCapExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "perTradeProof",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "totalCapExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "totalProof",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "drawdownPctExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "drawdownProof",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confidentialProtocolId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "fund",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "amountExt",
        type: "bytes32",
        internalType: "externalEuint64",
      },
      {
        name: "inputProof",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lastReceipt",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandateAgent",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandateComplianceOfficer",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandateExists",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandateNonce",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandatePrincipal",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mandateToken",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC7984",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sealedLimits",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "perTradeCap",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "totalCap",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "drawdownPct",
        type: "bytes32",
        internalType: "euint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sealedPayeeFlag",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "payee",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "ebool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "sealedState",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "spent",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "custody",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "highWaterMark",
        type: "bytes32",
        internalType: "euint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPayeeAllowed",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "payee",
        type: "address",
        internalType: "address",
      },
      {
        name: "allowedExt",
        type: "bytes32",
        internalType: "externalEbool",
      },
      {
        name: "inputProof",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "clientNonce",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payee",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "bytes32",
        internalType: "euint64",
      },
    ],
    outputs: [
      {
        name: "receipt",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleCorridor",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "clientNonce",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payee",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "extraOk",
        type: "bytes32",
        internalType: "ebool",
      },
    ],
    outputs: [
      {
        name: "receipt",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "moved",
        type: "bytes32",
        internalType: "euint64",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleWithCondition",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "clientNonce",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "payee",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "bytes32",
        internalType: "euint64",
      },
      {
        name: "extraOk",
        type: "bytes32",
        internalType: "ebool",
      },
    ],
    outputs: [
      {
        name: "receipt",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AllowlistRotated",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MandateCommitted",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "principal",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "agent",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "token",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      {
        name: "id",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "nonce",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "receipt",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "outcomeHandle",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "MandateAlreadyExists",
    inputs: [],
  },
  {
    type: "error",
    name: "NotAgent",
    inputs: [],
  },
  {
    type: "error",
    name: "NotPrincipal",
    inputs: [],
  },
  {
    type: "error",
    name: "SenderNotAllowedToUseHandle",
    inputs: [
      {
        name: "handle",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "sender",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "StaleNonce",
    inputs: [],
  },
  {
    type: "error",
    name: "UnknownMandate",
    inputs: [],
  },
  {
    type: "error",
    name: "ZamaProtocolUnsupported",
    inputs: [],
  },
] as const;
