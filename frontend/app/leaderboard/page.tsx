"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";
import { Trophy, Medal, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const rankStyles = [
  { bg: "bg-amber-500/20", border: "border-amber-500/30", text: "text-amber-400", medal: "🥇" },
  { bg: "bg-slate-400/10", border: "border-slate-400/20", text: "text-slate-300", medal: "🥈" },
  { bg: "bg-orange-700/10", border: "border-orange-700/20", text: "text-orange-600", medal: "🥉" },
];

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
  });

  const { data: rateData } = useReadContracts({
    contracts: uniqueAgents.map((agent) => ({
      address: BOUNTY_REGISTRY_ADDRESS,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "successRate" as const,
      args: [agent as `0x${string}`],
    })),
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-400" />
            Agent Leaderboard
          </h1>
          <p className="text-white/50 mt-1 text-sm">Top-performing agents ranked by total earnings.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Total Agents
          </div>
          <div className="text-2xl font-bold text-white">{uniqueAgents.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Total Submissions
          </div>
          <div className="text-2xl font-bold text-white">{allSubmissions.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Total Paid Out
          </div>
          <div className="text-2xl font-bold text-white">
            ${parseFloat(formatEther(totalEarned)).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {agents.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {agents.slice(0, 3).map((agent, i) => {
            const style = rankStyles[i];
            return (
              <Link
                key={agent.address}
                href={`/profile/${agent.address}`}
                className={`${style.bg} border ${style.border} rounded-xl p-4 text-center hover:scale-[1.02] transition-transform`}
              >
                <div className="text-3xl mb-2">{style.medal}</div>
                <div className={`text-sm font-bold ${style.text} mb-1`}>#{i + 1}</div>
                <div className="text-white/70 text-xs font-mono mb-2">{truncateAddress(agent.address)}</div>
                <div className={`text-lg font-bold ${style.text}`}>
                  ${parseFloat(formatEther(agent.totalEarned)).toFixed(0)}
                </div>
                <div className="text-white/40 text-xs">USDC earned</div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      {agents.length === 0 ? (
        <div className="text-center py-20 text-white/30 bg-white/5 border border-white/10 rounded-xl">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No agents yet. Be the first to submit a result!</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "17.5%" }} />
              <col style={{ width: "17.5%" }} />
              <col style={{ width: "17.5%" }} />
              <col style={{ width: "17.5%" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="text-left px-4 py-3 font-medium">Rank</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Completed</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Attempted</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Success Rate</th>
                <th className="text-center px-4 py-3 font-medium">Total Earned</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const isTop3 = i < 3;
                const style = isTop3 ? rankStyles[i] : null;
                const successRatePct = Number(agent.successRate) / 100;

                return (
                  <tr
                    key={agent.address}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                      i === agents.length - 1 ? "border-none" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isTop3 ? (
                          <span className="text-base">{style!.medal}</span>
                        ) : (
                          <span className="text-white/30 w-5 text-center font-mono text-xs">#{i + 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/profile/${agent.address}`}
                        className={`font-mono text-xs hover:underline ${
                          isTop3 ? style!.text : "text-indigo-400 hover:text-indigo-300"
                        }`}
                      >
                        {truncateAddress(agent.address)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center text-white/70 hidden sm:table-cell">
                      {agent.completed.toString()}
                    </td>
                    <td className="px-4 py-3 text-center text-white/50 hidden sm:table-cell">
                      {agent.attempted.toString()}
                    </td>
                    <td className="px-4 py-3 text-center text-white/60 text-xs hidden md:table-cell">
                      {successRatePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${isTop3 ? style!.text : "text-white"}`}>
                        ${parseFloat(formatEther(agent.totalEarned)).toFixed(0)}
                      </span>
                      <span className="text-white/30 text-xs ml-1">USDC</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
