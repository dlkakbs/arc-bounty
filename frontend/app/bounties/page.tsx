"use client";

import { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function BountiesPage() {
  const [activeTab, setActiveTab] = useState("all");

  const { data: bountyCount } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bountyCount",
  });

  const count = Number(bountyCount ?? 0);
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const { data: bountyData, isLoading: bountiesLoading } = useReadContracts({
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

  const bounties = (bountyData ?? []).map((d) => d.result as any);
  const submissions = (submissionData ?? []).map((d) => (d.result as any[]) ?? []);

  const statusFilter: Record<string, number | null> = {
    all: null,
    open: 0,
    completed: 1,
    cancelled: 2,
  };

  const filteredIds = ids.filter((id) => {
    const idx = Number(id) - 1;
    const b = bounties[idx];
    if (!b) return false;
    const filterStatus = statusFilter[activeTab];
    if (filterStatus === null) return true;
    return Number(b[7]) === filterStatus;
  });

  const countByStatus = (status: number | null) =>
    ids.filter((id) => {
      const b = bounties[Number(id) - 1];
      if (!b) return false;
      return status === null ? true : Number(b[7]) === status;
    }).length;

  return (
    <main className="section">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'2.5rem' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '0.5rem' }}>// Bounties</p>
          <h1 style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800, color:'#fff' }}>
            All Bounties
          </h1>
        </div>
        <a href="/create" className="btn-primary">Post Bounty</a>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'0', marginBottom:'2rem', borderBottom:'1px solid var(--border)' }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={{
              fontFamily:'var(--mono)', fontSize:'0.7rem', letterSpacing:'0.1em',
              textTransform:'uppercase', padding:'0.6rem 1.25rem',
              background: activeTab === tab.value ? 'var(--amber)' : 'transparent',
              color:       activeTab === tab.value ? 'var(--bg)'   : 'var(--muted)',
              border:'none', borderBottom: activeTab === tab.value
                ? '2px solid var(--amber)' : '2px solid transparent',
              cursor:'crosshair', transition:'all 0.2s',
            }}
          >{tab.label} ({countByStatus(statusFilter[tab.value])})</button>
        ))}
      </div>

      {/* Bounty rows */}
      {bountiesLoading ? (
        <div style={{ textAlign:'center', padding:'6rem 2rem', color:'var(--muted)', fontSize:'0.8rem' }}>
          Loading...
        </div>
      ) : filteredIds.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'6rem 2rem',
          color:'var(--muted)', fontSize:'0.8rem', letterSpacing:'0.1em',
        }}>
          <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>📭</div>
          NO BOUNTIES YET
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'1px', background:'var(--border)' }}>
          {[...filteredIds].reverse().map(id => {
            const idx = Number(id) - 1;
            const b = bounties[idx];
            if (!b) return null;
            const bStatus = Number(b[7]);
            const statusLabel = bStatus === 0 ? 'open' : bStatus === 1 ? 'completed' : 'cancelled';
            return (
              <a key={id.toString()} href={`/bounties/${id}`} style={{ textDecoration:'none' }}>
                <div className="card" style={{
                  display:'grid',
                  gridTemplateColumns:'auto 1fr auto auto',
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
                    <p style={{ color:'var(--muted)', fontSize:'0.65rem', letterSpacing:'0.08em' }}>
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
    </main>
  );
}
