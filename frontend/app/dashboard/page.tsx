"use client";

import { useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther, parseAbiItem } from "viem";
import { useEffect, useState } from "react";

const IDENTITY_REGISTRY_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

export default function Dashboard() {
  const publicClient = usePublicClient();
  const [registeredAgentCount, setRegisteredAgentCount] = useState(0);

  useEffect(() => {
    if (!publicClient) return;
    const fetch = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: IDENTITY_REGISTRY,
          event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
          args: { from: "0x0000000000000000000000000000000000000000" },
          fromBlock: BigInt(0),
        });
        setRegisteredAgentCount(logs.length);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => clearInterval(interval);
  }, [publicClient]);

  const { data: bountyCount } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bountyCount",
    query: { refetchInterval: 10_000 },
  });

  const count = Number(bountyCount ?? 0);
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const bountyReads = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "bounties" as const,
      args: [id],
    })),
    query: { refetchInterval: 10_000 },
  });

  const submissionReads = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "getSubmissions" as const,
      args: [id],
    })),
    query: { refetchInterval: 10_000 },
  });

  const bounties = (bountyReads.data ?? []).map((d) => d.result as any);
  const submissions = (submissionReads.data ?? []).map((d) => (d.result as any[]) ?? []);

  const creators = bounties.map((b) => b?.[0]).filter(Boolean) as string[];
  const creatorIdentityReads = useReadContracts({
    contracts: creators.map((addr) => ({
      address: IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "balanceOf" as const,
      args: [addr as `0x${string}`],
    })),
  });
  const creatorIsAgentMap = Object.fromEntries(
    creators.map((addr, i) => [addr.toLowerCase(), Number(creatorIdentityReads.data?.[i]?.result ?? 0) > 0])
  );

  const openBounties = bounties.filter((b) => b && b[7] === 0);
  const totalLocked = openBounties.reduce((acc: bigint, b: any) => acc + BigInt(b[2] ?? 0), BigInt(0));
  const totalAgents = new Set(submissions.flat().map((s: any) => s?.agent).filter(Boolean)).size;
  const recentIds = [...ids].reverse().slice(0, 6);

  return (
    <main className="section">
      <p className="section-label">// Overview</p>
      <h1 style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800,
        color:'#fff', marginBottom:'2.5rem' }}>
        Dashboard
      </h1>

      {/* Quick stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(5,1fr)',
        gap:1, background:'var(--border)', marginBottom:'2rem',
      }}>
        {[
          { val: count.toString(),                                                     label:'Total Bounties',    color:'var(--amber)' },
          { val: openBounties.length.toString(),                                      label:'Open Bounties',     color:'var(--amber)' },
          { val: `$${parseFloat(formatEther(totalLocked)).toFixed(0)}`,               label:'USDC Locked',       color:'var(--amber)' },
          { val: registeredAgentCount.toString(),                                     label:'Registered Agents', color:'var(--green)' },
          { val: totalAgents.toString(),                                               label:'Active Agents',     color:'var(--text)'  },
        ].map(({ val, label, color }) => (
          <div key={label} style={{
            background:'var(--surface)', padding:'1.5rem', textAlign:'center',
          }}>
            <span style={{ fontFamily:'var(--sans)', fontSize:'1.75rem', fontWeight:800,
              color, display:'block', marginBottom:'0.3rem' }}>{val}</span>
            <span style={{ fontSize:'0.6rem', letterSpacing:'0.14em',
              textTransform:'uppercase', color:'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Recent bounties */}
      <p className="section-label">// Recent Bounties</p>
      {recentIds.length === 0 ? (
        <p style={{ color:'var(--muted)', fontSize:'0.75rem' }}>
          No bounties yet.{' '}
          <a href="/create" style={{ color:'var(--amber)' }}>Create the first one.</a>
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
          {recentIds.map((id) => {
            const idx = Number(id) - 1;
            const b = bounties[idx];
            if (!b) return null;
            const bStatus = Number(b[7]);
            const statusLabel = bStatus === 0 ? 'open' : bStatus === 1 ? 'completed' : 'cancelled';
            return (
              <a key={id.toString()} href={`/bounties/${id}`} style={{ textDecoration:'none' }}>
                <div className="card" style={{
                  display:'grid', gridTemplateColumns:'auto 1fr auto auto',
                  gap:'1.5rem', alignItems:'center',
                }}>
                  <span style={{ fontFamily:'var(--sans)', fontSize:'1.1rem',
                    fontWeight:800, color:'var(--border)' }}>
                    #{String(Number(id)).padStart(3,'0')}
                  </span>
                  <div>
                    <p style={{ color:'#fff', fontSize:'0.85rem', marginBottom:'0.25rem' }}>
                      Bounty #{id.toString()}
                    </p>
                    <p style={{ color:'var(--muted)', fontSize:'0.65rem' }}>
                      {b[0]?.slice(0,6)}...{b[0]?.slice(-4)}
                    </p>
                  </div>
                  <span style={{ fontFamily:'var(--sans)', fontWeight:800,
                    color:'var(--amber)', fontSize:'1rem' }}>
                    ${parseFloat(formatEther(BigInt(b[2] ?? 0))).toFixed(0)} USDC
                  </span>
                  <span className={`badge badge-${bStatus === 0 ? 'green' : bStatus === 2 ? 'red' : 'muted'}`}>
                    {statusLabel}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Quick links */}
      <div style={{ display:'flex', gap:'1rem', marginTop:'2rem' }}>
        <a href="/bounties" className="btn-primary">Browse Bounties</a>
        <a href="/create"   className="btn-ghost">Post a Task</a>
      </div>
    </main>
  );
}
