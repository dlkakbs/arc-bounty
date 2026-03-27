"use client";

import { use, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { keccak256, toHex, formatEther } from "viem";
import { toast } from "sonner";
import { Countdown } from "@/components/Countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  Trophy,
  Users,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Bot,
} from "lucide-react";
import Link from "next/link";

const statusConfig = {
  0: { label: "Open", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  1: { label: "Completed", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  2: { label: "Cancelled", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const typeConfig = {
  0: { label: "Manual Approval", className: "bg-violet-500/20 text-violet-400 border-violet-500/30", icon: Shield },
  1: { label: "Auto-Pay", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Zap },
};

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };
  return (
    <button onClick={handleCopy} className="text-white/30 hover:text-white/70 transition-colors">
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bountyId = BigInt(id);
  const { address: userAddress } = useAccount();

  const [resultText, setResultText] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const { data: bountyRaw, refetch: refetchBounty } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "bounties",
    args: [bountyId],
  });

  const { data: submissionsRaw, refetch: refetchSubmissions } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "getSubmissions",
    args: [bountyId],
  });

  const { data: agentBalance } = useReadContract({
    address: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] }] as const,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });
  const isRegisteredAgent = Number(agentBalance ?? 0) > 0;

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (isConfirmed && txHash) {
    refetchBounty();
    refetchSubmissions();
  }

  if (!bountyRaw) {
    return (
      <div className="text-center py-20 text-white/30">
        <div className="text-4xl mb-3">⏳</div>
        <p>Loading bounty...</p>
      </div>
    );
  }

  const [creator, taskHash, reward, deadline, challengePeriod, validationType, validator, status, winner] =
    bountyRaw as [string, `0x${string}`, bigint, bigint, bigint, number, string, number, string];

  const submissions = (submissionsRaw as any[]) ?? [];
  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = Number(deadline);
  const challengePeriodNum = Number(challengePeriod);
  const isDeadlinePassed = now > deadlineNum;
  const isCreator = userAddress?.toLowerCase() === creator.toLowerCase();
  const isValidator = userAddress?.toLowerCase() === validator.toLowerCase();

  const userSubmission = submissions.find(
    (s: any) => s.agent?.toLowerCase() === userAddress?.toLowerCase()
  );

  const statusInfo = statusConfig[status as keyof typeof statusConfig];
  const typeInfo = typeConfig[validationType as keyof typeof typeConfig];
  const TypeIcon = typeInfo.icon;

  const handleSubmitResult = () => {
    if (!resultText.trim()) {
      toast.error("Please enter a result description");
      return;
    }
    const resultHash = keccak256(toHex(resultText));
    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "submitResult",
        args: [bountyId, resultHash],
      },
      {
        onSuccess: () => {
          toast.success("Result submitted! Waiting for confirmation...");
          setShowSubmitForm(false);
          setResultText("");
        },
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const handleClaimOptimistic = () => {
    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "claimOptimistic",
        args: [bountyId],
      },
      {
        onSuccess: () => toast.success("Claim submitted! Waiting for confirmation..."),
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const handleChallenge = (agentAddress: string) => {
    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "challengeResult",
        args: [bountyId, agentAddress as `0x${string}`],
      },
      {
        onSuccess: () => toast.success("Challenge submitted! Waiting for confirmation..."),
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const handleApprove = (agentAddress: string) => {
    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "approveResult",
        args: [bountyId, agentAddress as `0x${string}`],
      },
      {
        onSuccess: () => toast.success("Approved! Waiting for confirmation..."),
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const handleReject = (agentAddress: string) => {
    writeContract(
      {
        address: BOUNTY_REGISTRY_ADDRESS,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "rejectResult",
        args: [bountyId, agentAddress as `0x${string}`],
      },
      {
        onSuccess: () => toast.success("Rejected! Waiting for confirmation..."),
        onError: (e) => toast.error(e.message ?? "Transaction failed"),
      }
    );
  };

  const isBusy = isPending || isConfirming;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/30 text-sm font-mono">Bounty #{id}</span>
            <Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge>
            <Badge className={`text-xs ${typeInfo.className}`}>
              <TypeIcon className="w-3 h-3 mr-1" />
              {typeInfo.label}
            </Badge>
          </div>
          <div className="text-sm text-white/40 font-mono">
            Created by{" "}
            <Link href={`/profile/${creator}`} className="text-indigo-400 hover:text-indigo-300">
              {truncateAddress(creator)}
            </Link>
          </div>
        </div>
        <Link href="/bounties" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Back
        </Link>
      </div>

      {/* Reward + Timer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="text-white/40 text-sm mb-1 flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Reward
          </div>
          <div className="text-4xl font-bold text-white">
            {parseFloat(formatEther(reward)).toFixed(0)}
          </div>
          <div className="text-white/40 text-sm mt-1">USDC</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="text-white/40 text-sm mb-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {isDeadlinePassed ? "Deadline Passed" : "Time Remaining"}
          </div>
          <div className="text-2xl font-bold font-mono">
            {isDeadlinePassed ? (
              <span className="text-red-400">Expired</span>
            ) : (
              <Countdown target={deadlineNum} className="text-white" />
            )}
          </div>
          <div className="text-white/30 text-xs mt-1">
            {new Date(deadlineNum * 1000).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Task Hash + Details */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-sm font-medium">Bounty Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/40">Task Hash</span>
            <div className="flex items-center gap-2 font-mono text-white/70">
              <span>{truncateHash(taskHash)}</span>
              <CopyButton text={taskHash} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">Validator</span>
            <div className="flex items-center gap-2">
              <Link href={`/profile/${validator}`} className="font-mono text-indigo-400 hover:text-indigo-300 text-xs">
                {truncateAddress(validator)}
              </Link>
              <CopyButton text={validator} />
            </div>
          </div>
          {validationType === 1 && (
            <div className="flex items-center justify-between">
              <span className="text-white/40">Challenge Period</span>
              <span className="text-white/70">{Math.floor(challengePeriodNum / 3600)}h</span>
            </div>
          )}
          {status === 1 && winner && winner !== "0x0000000000000000000000000000000000000000" && (
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-white/40 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" /> Winner
              </span>
              <Link href={`/profile/${winner}`} className="font-mono text-amber-400 hover:text-amber-300 text-xs">
                {truncateAddress(winner)}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimistic Challenge Period Info */}
      {validationType === 1 && submissions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium text-sm">Auto-Pay</p>
              <p className="text-amber-400/70 text-sm mt-1">
                Submissions auto-approve after {Math.floor(challengePeriodNum / 3600)}h unless challenged.
                Challengers may dispute results before the window closes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {userAddress && (
        <div className="flex flex-wrap gap-3">
          {/* Submit Result — sadece registered agent'lar */}
          {status === 0 && !isDeadlinePassed && !isCreator && !userSubmission && (
            isRegisteredAgent ? (
              <Button
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                onClick={() => setShowSubmitForm(!showSubmitForm)}
              >
                Submit Result
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-sm">
                <Bot className="w-4 h-4" />
                Only registered agents can submit
              </div>
            )
          )}

          {/* Claim Optimistic */}
          {validationType === 1 &&
            userSubmission &&
            !userSubmission.challenged &&
            !userSubmission.approved &&
            !userSubmission.rejected &&
            now > Number(userSubmission.submittedAt) + challengePeriodNum && (
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleClaimOptimistic}
                disabled={isBusy}
              >
                {isBusy ? "Processing..." : "Claim Reward"}
              </Button>
            )}
        </div>
      )}

      {/* Submit Form */}
      {showSubmitForm && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm">Submit Your Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/50 text-xs">
              Describe your result. It will be hashed (keccak256) before submission.
            </p>
            <Textarea
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Describe your result or paste the output URL..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-24"
            />
            {resultText && (
              <div className="text-xs text-white/30 font-mono">
                Hash: {keccak256(toHex(resultText)).slice(0, 20)}...
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                onClick={handleSubmitResult}
                disabled={isBusy || !resultText.trim()}
              >
                {isBusy ? "Submitting..." : "Submit"}
              </Button>
              <Button variant="outline" onClick={() => setShowSubmitForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tx confirmation banner */}
      {txHash && (
        <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${isConfirmed ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-white/5 border border-white/10 text-white/50"}`}>
          {isConfirming && <div className="w-3 h-3 rounded-full border border-white/30 border-t-white/70 animate-spin" />}
          {isConfirmed && <CheckCircle className="w-4 h-4" />}
          <span className="font-mono text-xs truncate">{isConfirmed ? "Confirmed: " : "Pending: "}{txHash}</span>
        </div>
      )}

      {/* Submissions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-white/40" />
          <h2 className="text-white font-semibold">
            Submissions <span className="text-white/30 font-normal text-sm">({submissions.length})</span>
          </h2>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-12 text-white/30 bg-white/5 border border-white/10 rounded-xl">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No submissions yet. Be the first to submit!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any, idx: number) => {
              const isUserSub = userAddress?.toLowerCase() === sub.agent?.toLowerCase();
              const challengeExpiry = Number(sub.submittedAt) + challengePeriodNum;
              const isChallengeActive = validationType === 1 && now < challengeExpiry && !sub.challenged;
              const canChallenge = isChallengeActive && !isUserSub && userAddress;

              return (
                <div
                  key={idx}
                  className={`bg-white/5 border rounded-xl p-4 ${isUserSub ? "border-indigo-500/40" : "border-white/10"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          href={`/profile/${sub.agent}`}
                          className="text-sm font-mono text-indigo-400 hover:text-indigo-300 truncate"
                        >
                          {truncateAddress(sub.agent)}
                        </Link>
                        {isUserSub && (
                          <span className="text-xs text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded">You</span>
                        )}
                        {sub.approved && (
                          <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {sub.rejected && (
                          <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </Badge>
                        )}
                        {sub.challenged && (
                          <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Challenged
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-white/30 font-mono">
                        Hash: {truncateHash(sub.resultHash)}
                      </div>
                      <div className="text-xs text-white/30 mt-1">
                        Submitted {new Date(Number(sub.submittedAt) * 1000).toLocaleString()}
                      </div>
                      {validationType === 1 && isChallengeActive && (
                        <div className="text-xs text-amber-400/70 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Challenge window closes: {new Date(challengeExpiry * 1000).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Action buttons per submission */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {/* Challenge button */}
                      {canChallenge && status === 0 && (
                        <Button
                          size="sm"
                          className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30 text-xs"
                          onClick={() => handleChallenge(sub.agent)}
                          disabled={isBusy}
                        >
                          {isBusy ? "..." : "Challenge"}
                        </Button>
                      )}

                      {/* Validator approve/reject buttons */}
                      {isValidator && validationType === 0 && !sub.approved && !sub.rejected && status === 0 && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs"
                            onClick={() => handleApprove(sub.agent)}
                            disabled={isBusy}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 text-xs"
                            onClick={() => handleReject(sub.agent)}
                            disabled={isBusy}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
