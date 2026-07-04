// AUTO-GENERATED from packages/foundry/out — do not edit by hand.
// Regenerate after a contract change: see scratchpad/gen-abis.mjs.

export const confidentialFeedAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_publisher",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizeConsumer",
    inputs: [
      {
        name: "_consumer",
        type: "address",
        internalType: "address",
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
    name: "consumer",
    inputs: [],
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
    name: "hasValue",
    inputs: [],
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
    name: "postValue",
    inputs: [
      {
        name: "valueExt",
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
    name: "publisher",
    inputs: [],
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
    name: "value",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "euint64",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ConsumerAuthorized",
    inputs: [
      {
        name: "consumer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ValuePosted",
    inputs: [],
    anonymous: false,
  },
  {
    type: "error",
    name: "ConsumerUnset",
    inputs: [],
  },
  {
    type: "error",
    name: "NotPublisher",
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
    name: "ZamaProtocolUnsupported",
    inputs: [],
  },
] as const;
