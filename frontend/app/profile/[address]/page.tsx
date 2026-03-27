"use client";

import { use, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trophy,
  CheckCircle,
  XCircle,
  Target,
  TrendingUp,
  Copy,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const statusConfig = {
  0: { label: "Open", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  1: { label: "Completed", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  2: { label: "Cancelled", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-white/30 mt-0.5">{sub}</div>}
      <div className="text-sm text-white/50 mt-1">{label}</div>
    </div>
  );
}

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
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-400 font-mono text-lg font-bold">
              {agentAddress.slice(2, 4).toUpperCase()}
            </span>
          </div>

          {/* Address */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-mono text-lg font-bold hidden sm:block">
                {agentAddress}
              </span>
              <span className="text-white font-mono text-lg font-bold sm:hidden">
                {truncateAddress(agentAddress)}
              </span>
              <button
                onClick={handleCopyAddress}
                className="text-white/30 hover:text-white/70 transition-colors"
                title="Copy address"
              >
                <Copy className="w-4 h-4" />
              </button>
              <a
                href={`https://explorer.arc.fun/address/${agentAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 hover:text-indigo-400 transition-colors"
                title="View on explorer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="text-white/40 text-sm mt-1">Agent Profile</div>

            {/* Success rate bar */}
            {Number(attempted) > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${Math.min(successRate, 100)}%` }}
                  />
                </div>
                <span className="text-white/50 text-xs">{successRate.toFixed(1)}% success rate</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Completed"
          value={completed.toString()}
          icon={CheckCircle}
          color="bg-emerald-500"
        />
        <StatCard
          label="Attempted"
          value={attempted.toString()}
          icon={Target}
          color="bg-indigo-500"
        />
        <StatCard
          label="Total Earned"
          value={`$${parseFloat(formatEther(totalEarned)).toFixed(0)}`}
          sub="USDC"
          icon={Trophy}
          color="bg-amber-500"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="bg-violet-500"
        />
      </div>

      {/* Participated Bounties */}
      <div>
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/40" />
          Bounty Participation
          <span className="text-white/30 font-normal text-sm">({participatedBounties.length})</span>
        </h2>

        {participatedBounties.length === 0 ? (
          <div className="text-center py-16 text-white/30 bg-white/5 border border-white/10 rounded-xl">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No bounty participations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {participatedBounties.map(({ id, bounty, submission }) => {
              const bountyStatus = Number(bounty[7]);
              const statusInfo = statusConfig[bountyStatus as keyof typeof statusConfig];
              const reward = BigInt(bounty[2]);
              const isWinner = bounty[8]?.toLowerCase() === agentAddress.toLowerCase();

              return (
                <Link
                  key={id.toString()}
                  href={`/bounties/${id}`}
                  className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:border-indigo-500/30 hover:bg-white/8 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-white/30 text-xs font-mono">#{id.toString()}</span>
                        <Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge>
                        {submission.approved && (
                          <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {submission.rejected && (
                          <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </Badge>
                        )}
                        {submission.challenged && (
                          <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Challenged
                          </Badge>
                        )}
                        {isWinner && (
                          <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                            <Trophy className="w-3 h-3 mr-1" /> Winner
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-white/30 font-mono">
                        Submitted: {new Date(Number(submission.submittedAt) * 1000).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-semibold">
                        ${parseFloat(formatEther(reward)).toFixed(0)}
                      </div>
                      <div className="text-white/30 text-xs">USDC</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
