"use client";

import { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { BountyCard } from "@/components/BountyCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap } from "lucide-react";
import Link from "next/link";

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">All Bounties</h1>
          <p className="text-white/50 mt-1">Browse and claim on-chain tasks</p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
        >
          <Zap className="w-4 h-4" />
          Post Bounty
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          {FILTER_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-white/60 data-active:text-white data-active:bg-white/10">
              {tab.label}
              <span className="ml-1.5 text-xs text-white/30">
                ({countByStatus(statusFilter[tab.value])})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {FILTER_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {bountiesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredIds.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <div className="text-4xl mb-3">📭</div>
                <p>No {tab.value === "all" ? "" : tab.label.toLowerCase()} bounties yet.</p>
                {tab.value === "open" && (
                  <Link href="/create" className="text-indigo-400 hover:underline text-sm mt-2 inline-block">
                    Create the first one
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {[...filteredIds].reverse().map((id) => {
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
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
