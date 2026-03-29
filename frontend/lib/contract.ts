export const BOUNTY_REGISTRY_ADDRESS =
  "0xD52fFD67b1AfC230EDaBAD66B5657aCDA385D645" as const;

export const BOUNTY_REGISTRY_ABI = [
  // Write
  {
    name: "createBounty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "taskHash", type: "bytes32" },
      { name: "deadline", type: "uint256" },
      { name: "validationType", type: "uint8" },
      { name: "validator", type: "address" },
      { name: "challengePeriod", type: "uint256" },
    ],
    outputs: [{ name: "bountyId", type: "uint256" }],
  },
  {
    name: "submitResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
      { name: "result", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "approveResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "rejectResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "claimOptimistic",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "challengeResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "resolveDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "cancelBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  // Read
  {
    name: "bountyCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "bounties",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "taskHash", type: "bytes32" },
      { name: "reward", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "challengePeriod", type: "uint256" },
      { name: "validationType", type: "uint8" },
      { name: "validator", type: "address" },
      { name: "status", type: "uint8" },
      { name: "winner", type: "address" },
    ],
  },
  {
    name: "getSubmissions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "agent", type: "address" },
          { name: "resultHash", type: "bytes32" },
          { name: "submittedAt", type: "uint256" },
          { name: "challenged", type: "bool" },
          { name: "approved", type: "bool" },
          { name: "rejected", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "agentStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "completed", type: "uint256" },
      { name: "attempted", type: "uint256" },
      { name: "totalEarned", type: "uint256" },
    ],
  },
  {
    name: "successRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  // Events
  {
    name: "BountyCreated",
    type: "event",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "validationType", type: "uint8", indexed: false },
      { name: "title", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    name: "ResultSubmitted",
    type: "event",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "resultHash", type: "bytes32", indexed: false },
      { name: "result", type: "string", indexed: false },
    ],
  },
  {
    name: "RewardClaimed",
    type: "event",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// Validation types
export const ValidationType = { EXPLICIT: 0, OPTIMISTIC: 1 } as const;

// Bounty status
export const BountyStatus = { OPEN: 0, COMPLETED: 1, CANCELLED: 2 } as const;
