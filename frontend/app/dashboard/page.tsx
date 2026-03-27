"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";

const IDENTITY_REGISTRY_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
import { BountyCard } from "@/components/BountyCard";
import { Zap, DollarSign, Users, Trophy } from "lucide-react";
import { formatEther } from "viem";
import Link from "next/link";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/50 mt-0.5">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: bountyCount } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bountyCount",
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
  });

  const submissionReads = useReadContracts({
    contracts: ids.map((id) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "getSubmissions" as const,
      args: [id],
    })),
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
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bounties" value={count.toString()} icon={Zap} color="bg-indigo-500" />
        <StatCard label="Open Bounties" value={openBounties.length.toString()} icon={DollarSign} color="bg-emerald-500" />
        <StatCard label="USDC Locked" value={`$${parseFloat(formatEther(totalLocked)).toFixed(0)}`} icon={Trophy} color="bg-amber-500" />
        <StatCard label="Active Agents" value={totalAgents.toString()} icon={Users} color="bg-violet-500" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Bounties</h2>
          <Link href="/bounties" className="text-sm text-indigo-400 hover:text-indigo-300">View all →</Link>
        </div>
        {count === 0 ? (
          <div className="text-center py-16 text-white/30">
            No bounties yet. <Link href="/create" className="text-indigo-400 hover:underline">Create the first one.</Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {recentIds.map((id) => {
              const idx = Number(id) - 1;
              const b = bounties[idx];
              if (!b) return null;
              return (
                <BountyCard
                  key={id.toString()}
                  id={id}
                  creator={b[0]}
                  reward={BigInt(b[2])}
                  deadline={BigInt(b[3])}
                  validationType={Number(b[5])}
                  status={Number(b[7])}
                  submissionCount={submissions[idx]?.length ?? 0}
                  creatorIsAgent={creatorIsAgentMap[b[0]?.toLowerCase()] ?? false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
