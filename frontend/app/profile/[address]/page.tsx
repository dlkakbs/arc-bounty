"use client";

import { use, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";
import { toast } from "sonner";

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address: agentAddress } = use(params);

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(agentAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: statsRaw } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "agentStats",
    args: [agentAddress as `0x${string}`],
  });

  const { data: successRateRaw } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "successRate",
    args: [agentAddress as `0x${string}`],
  });

  const { data: bountyCount } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bountyCount",
  });

  const count = Number(bountyCount ?? 0);
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const { data: bountyData } = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "bounties" as const,
      args: [id],
    })),
  });

  const { data: submissionData } = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "getSubmissions" as const,
      args: [id],
    })),
  });

  const stats = statsRaw as any;
  const completed = stats ? BigInt(stats[0]) : BigInt(0);
  const attempted = stats ? BigInt(stats[1]) : BigInt(0);
  const totalEarned = stats ? BigInt(stats[2]) : BigInt(0);
  const successRate = successRateRaw ? Number(successRateRaw as bigint) / 100 : 0;

  // Find bounties where this agent participated
  const participatedBounties = ids
    .map((id) => {
      const idx = Number(id) - 1;
      const bounty = (bountyData?.[idx]?.result as any) ?? null;
      const submissions = (submissionData?.[idx]?.result as any[]) ?? [];
      const agentSub = submissions.find(
        (s: any) => s.agent?.toLowerCase() === agentAddress.toLowerCase()
      );
      if (!agentSub || !bounty) return null;
      return { id, bounty, submission: agentSub };
    })
    .filter(Boolean) as { id: bigint; bounty: any; submission: any }[];

  return (
    <main className="section">
      <a href="/leaderboard" style={{
        color:'var(--muted)', fontSize:'0.7rem', letterSpacing:'0.1em',
        textDecoration:'none', marginBottom:'2rem', display:'inline-block',
      }}>← LEADERBOARD</a>

      {/* Agent header */}
      <div className="card" style={{
        display:'grid', gridTemplateColumns:'1fr auto',
        alignItems:'center', marginBottom:'2rem',
      }}>
        <div>
          <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.4rem' }}>
            AGENT ADDRESS
          </p>
          <p style={{ fontFamily:'var(--mono)', fontSize:'0.9rem', color:'#fff', wordBreak:'break-all' }}>
            {agentAddress}
          </p>
        </div>
        <span className="badge badge-green">REGISTERED</span>
      </div>

      {/* Stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:1, background:'var(--border)', marginBottom:'2rem',
      }}>
        {[
          { val: completed.toString(),                                      label:'Completed', color:'var(--green)' },
          { val: attempted.toString(),                                      label:'Attempted', color:'var(--text)'  },
          { val: `$${parseFloat(formatEther(totalEarned)).toFixed(0)}`,    label:'Earned',    color:'var(--amber)' },
        ].map(({ val, label, color }) => (
          <div key={label} style={{
            background:'var(--surface)', padding:'2rem', textAlign:'center',
          }}>
            <span style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800,
              color, display:'block', marginBottom:'0.3rem' }}>{val}</span>
            <span style={{ fontSize:'0.62rem', letterSpacing:'0.15em',
              textTransform:'uppercase', color:'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Participation history */}
      <p className="section-label">// Bounty Participation</p>
      {participatedBounties.length === 0 ? (
        <p style={{ color:'var(--muted)', fontSize:'0.75rem' }}>No submissions yet.</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
          {participatedBounties.map(({ id, bounty, submission }) => {
            const reward = BigInt(bounty[2]);
            const isApproved = submission.approved;
            const isWinner = bounty[8]?.toLowerCase() === agentAddress.toLowerCase();
            return (
              <div key={id.toString()} className="card" style={{
                display:'grid', gridTemplateColumns:'1fr auto auto', gap:'1rem', alignItems:'center',
              }}>
                <div>
                  <p style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.2rem' }}>
                    Bounty #{String(Number(id)).padStart(3,'0')}
                  </p>
                  <code style={{ fontSize:'0.68rem', color:'var(--text)' }}>
                    {submission.resultHash?.slice(0,20)}...
                  </code>
                </div>
                <span style={{ fontSize:'0.72rem', color:'var(--amber)' }}>
                  ${parseFloat(formatEther(reward)).toFixed(0)} USDC
                </span>
                <span className={`badge badge-${isWinner || isApproved ? 'green' : 'muted'}`}>
                  {isWinner ? 'WINNER' : isApproved ? 'APPROVED' : 'PENDING'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
