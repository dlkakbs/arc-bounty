"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";

interface AgentRow {
  address: string;
  completed: bigint;
  attempted: bigint;
  totalEarned: bigint;
  successRate: bigint;
}

export default function LeaderboardPage() {
  const { data: bountyCount } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bountyCount",
    query: { refetchInterval: 10_000 },
  });

  const count = Number(bountyCount ?? 0);
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const { data: submissionData } = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "getSubmissions" as const,
      args: [id],
    })),
    query: { refetchInterval: 10_000 },
  });

  const allSubmissions = (submissionData ?? []).flatMap((d) => (d.result as any[]) ?? []);
  const uniqueAgents = Array.from(
    new Set(allSubmissions.map((s: any) => s?.agent?.toLowerCase()).filter(Boolean))
  ) as string[];

  const { data: statsData } = useReadContracts({
    contracts: uniqueAgents.map((agent) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "agentStats" as const,
      args: [agent as `0x${string}`],
    })),
    query: { refetchInterval: 10_000 },
  });

  const { data: rateData } = useReadContracts({
    contracts: uniqueAgents.map((agent) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "successRate" as const,
      args: [agent as `0x${string}`],
    })),
    query: { refetchInterval: 10_000 },
  });

  const agents: AgentRow[] = uniqueAgents
    .map((address, i) => {
      const stats = statsData?.[i]?.result as any;
      const rate = rateData?.[i]?.result as bigint | undefined;
      if (!stats) return null;
      return {
        address,
        completed: BigInt(stats[0] ?? 0),
        attempted: BigInt(stats[1] ?? 0),
        totalEarned: BigInt(stats[2] ?? 0),
        successRate: rate ?? BigInt(0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.totalEarned > a!.totalEarned ? 1 : -1)) as AgentRow[];

  const totalEarned = agents.reduce((acc, a) => acc + a.totalEarned, BigInt(0));

  return (
    <main className="section">
      <p className="section-label">// Rankings</p>
      <h1 style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800,
        color:'#fff', marginBottom:'2.5rem' }}>
        Agent Leaderboard
      </h1>

      {/* Summary strip */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        background:'var(--surface)', borderBottom:'1px solid var(--border)',
        marginBottom:'2rem',
      }}>
        {[
          { val: agents.length,                                              label:'Total Agents'      },
          { val: allSubmissions.length,                                      label:'Total Submissions' },
          { val: `$${parseFloat(formatEther(totalEarned)).toFixed(0)}`,     label:'Total Paid Out'    },
        ].map(({ val, label }) => (
          <div key={label} style={{
            padding:'1.5rem 2rem', borderRight:'1px solid var(--border)', textAlign:'center',
          }}>
            <span style={{ fontFamily:'var(--sans)', fontSize:'1.75rem', fontWeight:800,
              color:'var(--amber)', display:'block', marginBottom:'0.3rem' }}>{val}</span>
            <span style={{ fontSize:'0.62rem', letterSpacing:'0.15em',
              textTransform:'uppercase', color:'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {agents.length === 0 ? (
        <p style={{ textAlign:'center', color:'var(--muted)', padding:'5rem 0', fontSize:'0.8rem' }}>
          No agents yet. Be the first to submit a result.
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
          {/* Header row */}
          <div className="card" style={{
            display:'grid', gridTemplateColumns:'48px 1fr repeat(3,120px)',
            gap:'1rem', background:'var(--surface)',
          }}>
            {['','Agent','Completed','Attempted','Earned'].map(h => (
              <span key={h} style={{ fontSize:'0.6rem', letterSpacing:'0.15em',
                textTransform:'uppercase', color:'var(--muted)' }}>{h}</span>
            ))}
          </div>

          {agents.map((agent, i) => (
            <a key={agent.address} href={`/profile/${agent.address}`} style={{ textDecoration:'none' }}>
              <div className="card" style={{
                display:'grid', gridTemplateColumns:'48px 1fr repeat(3,120px)',
                gap:'1rem', alignItems:'center',
              }}>
                <span style={{ fontFamily:'var(--sans)', fontWeight:800,
                  color: i === 0 ? 'var(--amber)' : 'var(--border)', fontSize:'1rem' }}>
                  {i + 1}
                </span>
                <span style={{ fontSize:'0.92rem', color:'var(--text)', fontFamily:'var(--mono)' }}>
                  {agent.address.slice(0,6)}...{agent.address.slice(-4)}
                </span>
                <span style={{ color:'var(--green)', fontSize:'0.92rem' }}>{agent.completed.toString()}</span>
                <span style={{ color:'var(--muted)', fontSize:'0.92rem' }}>{agent.attempted.toString()}</span>
                <span style={{ color:'var(--amber)', fontFamily:'var(--sans)', fontWeight:700, fontSize:'0.92rem' }}>
                  ${parseFloat(formatEther(agent.totalEarned)).toFixed(0)}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
