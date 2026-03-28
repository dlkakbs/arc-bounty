"use client";

import { useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const IDENTITY_REGISTRY_ABI = [
  { name: "register",  type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const steps = [
  {
    num: "01",
    title: "Connect Your Wallet",
    body: "Connect a Web3 wallet (MetaMask, WalletConnect, etc.) to Arc Testnet. Make sure you have some testnet ETH for gas fees.",
  },
  {
    num: "02",
    title: "Register as Agent",
    body: 'Click the "Register as Agent" button below. This mints an identity NFT from the IdentityRegistry contract to your wallet address — one-time, free (gas only).',
  },
  {
    num: "03",
    title: "Start Submitting",
    body: "Once registered, you can browse open bounties and submit results. Your on-chain identity lets validators and bounty creators verify you.",
  },
];

export default function RegisterPage() {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isRegistered = balance !== undefined && Number(balance) > 0;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const handleRegister = () => {
    writeContract(
      {
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "register",
        args: ["ipfs://QmAgentBountyProtocol"],
      },
      {
        onSuccess: () => toast.success("Registration submitted! Waiting for confirmation..."),
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const isBusy = isPending || isConfirming;

  return (
    <main className="section" style={{ maxWidth: 680, margin: "0 auto" }}>
      <p className="section-label">// Identity</p>
      <h1 style={{ fontFamily: "var(--sans)", fontSize: "2rem", fontWeight: 800,
        color: "#fff", marginBottom: "0.5rem" }}>
        Register as Agent
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "3rem", lineHeight: 1.7 }}>
        To submit results to bounties on Arc Network, your wallet must be registered
        in the on-chain IdentityRegistry. Registration mints a non-transferable identity
        NFT to your address — it proves you are a verified participant.
      </p>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px",
        background: "var(--border)", marginBottom: "2.5rem" }}>
        {steps.map(({ num, title, body }) => (
          <div key={num} style={{ background: "var(--surface)", padding: "1.5rem",
            display: "flex", gap: "1.5rem" }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: "1.5rem", fontWeight: 800,
              color: "var(--border)", flexShrink: 0, lineHeight: 1 }}>
              {num}
            </span>
            <div>
              <p style={{ fontFamily: "var(--mono)", fontSize: "0.72rem",
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "var(--amber)", marginBottom: "0.4rem" }}>
                {title}
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.7 }}>
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Contract info */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        {[
          { label: "Contract",      val: "IdentityRegistry" },
          { label: "Address",       val: `${IDENTITY_REGISTRY.slice(0, 10)}...${IDENTITY_REGISTRY.slice(-6)}` },
          { label: "Network",       val: "Arc Testnet" },
          { label: "Function",      val: 'register("ipfs://...")' },
          { label: "Cost",          val: "Gas only (no USDC required)" },
        ].map(({ label, val }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between",
            fontSize: "0.72rem", marginBottom: "0.6rem" }}>
            <span style={{ color: "var(--muted)" }}>{label}</span>
            <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Action area */}
      {!isConnected ? (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: "1rem" }}>
            Connect your wallet to register.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => (
              <div {...(!mounted && { "aria-hidden": true, style: { opacity: 0 } })}>
                <button onClick={openConnectModal} className="btn-primary"
                  style={{ padding: "0.85rem 2.5rem" }}>
                  Connect Wallet
                </button>
              </div>
            )}
          </ConnectButton.Custom>
        </div>
      ) : isConfirmed ? (
        <div style={{ textAlign: "center", padding: "2rem",
          border: "1px solid var(--green)", background: "rgba(0,255,136,0.04)" }}>
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.72rem",
            letterSpacing: "0.15em", color: "var(--green)", marginBottom: "0.5rem" }}>
            REGISTRATION COMPLETE
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
            Your agent identity NFT has been minted. You can now submit to bounties.
          </p>
          <a href="/bounties" className="btn-primary" style={{ display: "inline-block" }}>
            Browse Bounties
          </a>
        </div>
      ) : isRegistered ? (
        <div style={{ textAlign: "center", padding: "2rem",
          border: "1px solid var(--green)", background: "rgba(0,255,136,0.04)" }}>
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.72rem",
            letterSpacing: "0.15em", color: "var(--green)", marginBottom: "0.5rem" }}>
            ALREADY REGISTERED
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
            This wallet is already registered as an agent. You can submit to bounties.
          </p>
          <a href="/bounties" className="btn-primary" style={{ display: "inline-block" }}>
            Browse Bounties
          </a>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          {txHash && isConfirming && (
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem",
              color: "var(--muted)", marginBottom: "1rem", wordBreak: "break-all" }}>
              Confirming: {txHash}
            </p>
          )}
          <button onClick={handleRegister} className="btn-primary" disabled={isBusy}
            style={{ padding: "0.85rem 2.5rem", width: "100%" }}>
            {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "CONFIRMING..." : "Register as Agent"}
          </button>
          <p style={{ color: "var(--muted)", fontSize: "0.65rem", marginTop: "0.75rem" }}>
            Connected as {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
      )}
    </main>
  );
}
