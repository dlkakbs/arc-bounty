"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { keccak256, toHex, parseEther } from "viem";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function CreateBountyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [taskDescription, setTaskDescription] = useState("");
  const [reward, setReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [validationType, setValidationType] = useState<0 | 1>(0);
  const [validatorAddress, setValidatorAddress] = useState("");
  const [challengePeriodHours, setChallengePeriodHours] = useState("48");

  const [newBountyId, setNewBountyId] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const taskHash = taskDescription ? keccak256(toHex(taskDescription)) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskDescription.trim()) {
      toast.error("Task description is required");
      return;
    }
    if (!reward || parseFloat(reward) <= 0) {
      toast.error("Reward must be greater than 0");
      return;
    }
    if (!deadline) {
      toast.error("Deadline is required");
      return;
    }
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTs <= Math.floor(Date.now() / 1000)) {
      toast.error("Deadline must be in the future");
      return;
    }
    if (!validatorAddress || !validatorAddress.startsWith("0x")) {
      toast.error("Valid validator address required");
      return;
    }

    const hash = keccak256(toHex(taskDescription));
    const rewardWei = parseEther(reward);
    const challengePeriodSecs = BigInt(parseInt(challengePeriodHours) * 3600);

    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "createBounty",
        args: [
          hash,
          BigInt(deadlineTs),
          validationType,
          validatorAddress as `0x${string}`,
          challengePeriodSecs,
        ],
        value: rewardWei,
      },
      {
        onSuccess: (hash) => {
          toast.success("Bounty creation submitted! Waiting for confirmation...");
        },
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  // Redirect after confirmed (we'll use a dummy id for now since we can't easily get it from receipt here)
  const handleGoToBounty = () => {
    router.push("/bounties");
  };

  if (!isConnected) {
    return (
      <main className="section" style={{ maxWidth:480, margin:'0 auto', textAlign:'center', paddingTop:'10rem' }}>
        <div style={{
          width:48, height:48, margin:'0 auto 1.25rem',
          display:'flex', alignItems:'center', justifyContent:'center',
          border:'1px solid var(--amber)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <path d="M16 12h2"/>
            <path d="M2 10h20"/>
          </svg>
        </div>
        <h2 style={{ fontFamily:'var(--mono)', fontSize:'0.85rem', letterSpacing:'0.15em',
          color:'var(--amber)', textTransform:'uppercase', marginBottom:'0.25rem' }}>
          Connect
        </h2>
        <h2 style={{ fontFamily:'var(--mono)', fontSize:'0.85rem', letterSpacing:'0.15em',
          color:'var(--amber)', textTransform:'uppercase', marginBottom:'1.5rem' }}>
          Your Wallet
        </h2>
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <div {...(!mounted && { 'aria-hidden': true, style: { opacity: 0 } })}>
              <button onClick={openConnectModal} style={{
                fontFamily:'var(--mono)', fontSize:'0.75rem', letterSpacing:'0.12em',
                textTransform:'uppercase', padding:'0.7rem 2rem',
                background:'var(--amber)', color:'var(--bg)',
                border:'none', cursor:'crosshair', fontWeight:'bold',
              }}>
                Connect Wallet
              </button>
            </div>
          )}
        </ConnectButton.Custom>
      </main>
    );
  }

  if (isConfirmed && txHash) {
    return (
      <main className="section" style={{ maxWidth:480, margin:'0 auto', textAlign:'center', paddingTop:'8rem' }}>
        <p style={{ fontSize:'2rem', marginBottom:'1rem' }}>✓</p>
        <h2 style={{ fontFamily:'var(--sans)', fontSize:'1.75rem', fontWeight:800, color:'#fff', marginBottom:'0.5rem' }}>
          Bounty Created!
        </h2>
        <p style={{ color:'var(--muted)', fontSize:'0.8rem', marginBottom:'2rem' }}>
          Your bounty is now live on Arc Network.
        </p>
        <div className="card" style={{ textAlign:'left', marginBottom:'2rem' }}>
          {[
            { label:'Tx Hash', val: `${txHash.slice(0,10)}...${txHash.slice(-6)}` },
            { label:'Reward',  val: `${reward} USDC` },
            { label:'Validation', val: validationType === 0 ? 'Manual Approval' : 'Auto-Pay' },
          ].map(({ label, val }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between',
              fontSize:'0.75rem', marginBottom:'0.6rem' }}>
              <span style={{ color:'var(--muted)' }}>{label}</span>
              <span style={{ color:'var(--text)', fontFamily:'var(--mono)' }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center' }}>
          <button onClick={handleGoToBounty} className="btn-primary">View All Bounties</button>
          <button className="btn-ghost" onClick={() => {
            setTaskDescription(""); setReward(""); setDeadline("");
            setValidatorAddress(""); setChallengePeriodHours("48");
            window.location.reload();
          }}>Create Another</button>
        </div>
      </main>
    );
  }

  const isBusy = isPending || isConfirming;

  return (
    <main className="section" style={{ maxWidth:720, margin:'0 auto' }}>
      <p className="section-label">// New Bounty</p>
      <h1 style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800,
        color:'#fff', marginBottom:'2.5rem' }}>
        Deploy a Task
      </h1>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        <div>
          <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
            color:'var(--muted)', display:'block', marginBottom:'0.5rem' }}>
            Task Description
          </label>
          <textarea
            className="input-field"
            rows={4}
            placeholder="Describe the task for AI agents..."
            value={taskDescription}
            onChange={e => setTaskDescription(e.target.value)}
            style={{ resize:'vertical' }}
            required
          />
          {taskHash && (
            <p style={{ fontSize:'0.65rem', color:'var(--muted)', marginTop:'0.4rem', fontFamily:'var(--mono)' }}>
              Hash: {taskHash.slice(0,20)}...
            </p>
          )}
        </div>

        <div>
          <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
            color:'var(--muted)', display:'block', marginBottom:'0.5rem' }}>
            Reward (USDC)
          </label>
          <input
            className="input-field"
            type="number" min="0" step="0.01"
            placeholder="e.g. 100"
            value={reward}
            onChange={e => setReward(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
            color:'var(--muted)', display:'block', marginBottom:'0.5rem' }}>
            Deadline
          </label>
          <input
            type="datetime-local"
            className="input-field"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{ colorScheme:'dark' }}
            required
          />
        </div>

        <div>
          <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
            color:'var(--muted)', display:'block', marginBottom:'0.75rem' }}>
            Validation Mode
          </label>
          <div style={{ display:'flex', gap:'1px', background:'var(--border)' }}>
            {[
              { val:0, label:'MANUAL APPROVAL', desc:'Validator approves each submission manually.' },
              { val:1, label:'AUTO-PAY',         desc:'Auto-pays after challenge window expires.' },
            ].map(({ val, label, desc }) => (
              <button key={val} type="button"
                onClick={() => setValidationType(val as 0 | 1)}
                style={{
                  flex:1, padding:'1rem', textAlign:'left', cursor:'crosshair',
                  background: validationType === val ? 'rgba(245,166,35,0.08)' : 'var(--surface)',
                  border: validationType === val ? '1px solid var(--amber)' : '1px solid transparent',
                  transition:'all 0.2s',
                }}>
                <p style={{ fontFamily:'var(--mono)', fontSize:'0.72rem', letterSpacing:'0.1em',
                  color: validationType === val ? 'var(--amber)' : 'var(--text)',
                  marginBottom:'0.25rem' }}>{label}</p>
                <p style={{ fontSize:'0.65rem', color:'var(--muted)' }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {validationType === 1 && (
          <div>
            <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
              color:'var(--muted)', display:'block', marginBottom:'0.5rem' }}>
              Challenge Period (hours)
            </label>
            <input
              className="input-field"
              type="number" min="1" max="720"
              value={challengePeriodHours}
              onChange={e => setChallengePeriodHours(e.target.value)}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase',
            color:'var(--muted)', display:'block', marginBottom:'0.5rem' }}>
            {validationType === 0 ? 'Validator / Arbitrator Address' : 'Dispute Resolver Address'}
          </label>
          <input
            className="input-field"
            placeholder="0x..."
            value={validatorAddress}
            onChange={e => setValidatorAddress(e.target.value)}
            required
          />
          {address && (
            <button type="button" onClick={() => setValidatorAddress(address)}
              style={{ fontSize:'0.65rem', color:'var(--amber)', marginTop:'0.4rem',
                background:'none', border:'none', cursor:'crosshair', fontFamily:'var(--mono)' }}>
              Use my address
            </button>
          )}
        </div>

        {txHash && isConfirming && (
          <div style={{
            padding:'0.75rem 1rem', fontSize:'0.72rem', fontFamily:'var(--mono)',
            background:'var(--surface)', border:'1px solid var(--border)',
            color:'var(--muted)', wordBreak:'break-all',
          }}>
            ⏳ Confirming: {txHash}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={isBusy}
          style={{ width:'100%', padding:'1rem' }}>
          {isPending ? 'CONFIRM IN WALLET...' : isConfirming ? 'CONFIRMING...' : 'Post Bounty'}
        </button>
      </form>
    </main>
  );
}
