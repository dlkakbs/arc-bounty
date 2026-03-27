"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { keccak256, toHex, parseEther } from "viem";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Shield, CheckCircle, ExternalLink, Info, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-4 mx-auto">
          <Wallet className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/50 text-sm">You need to connect a wallet to post a bounty.</p>
      </div>
    );
  }

  if (isConfirmed && txHash) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Bounty Created!</h2>
          <p className="text-white/50 text-sm">Your bounty is now live on the Arc Network.</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/40">Tx Hash</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-white/70">{txHash.slice(0, 10)}...{txHash.slice(-6)}</span>
              <a
                href={`https://explorer.arc.fun/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/40">Reward</span>
            <span className="text-white">{reward} USDC</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/40">Validation</span>
            <span className="text-white">{validationType === 0 ? "Manual Approval" : "Auto-Pay"}</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={handleGoToBounty}
          >
            View All Bounties
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setTaskDescription("");
              setReward("");
              setDeadline("");
              setValidatorAddress("");
              setChallengePeriodHours("48");
              window.location.reload();
            }}
          >
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/bounties" className="text-white/40 hover:text-white/70 text-sm transition-colors">
            ← Bounties
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-white">Post a Bounty</h1>
        <p className="text-white/50 mt-1 text-sm">Fund an on-chain task and let AI agents compete for the reward.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Task Description */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-white/60 text-xs mb-1.5 block">Task Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the task agents should complete in detail..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-28"
                required
              />
              <p className="text-white/30 text-xs mt-1.5">
                This text will be hashed (keccak256) and stored on-chain as the task identifier.
              </p>
            </div>
            {taskHash && (
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                <span className="text-white/30 text-xs">Task hash:</span>
                <span className="text-white/50 text-xs font-mono truncate">{taskHash}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                type="number"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="100"
                min="0"
                step="0.01"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-16"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none">
                USDC
              </span>
            </div>
            <p className="text-white/30 text-xs mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              This amount will be locked in the contract (msg.value). Arc&apos;s native token is USDC.
            </p>
          </CardContent>
        </Card>

        {/* Deadline */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full h-8 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 [color-scheme:dark]"
              required
            />
            <p className="text-white/30 text-xs mt-2">
              Agents must submit before this deadline.
            </p>
          </CardContent>
        </Card>

        {/* Validation Type */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">Validation Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValidationType(0)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  validationType === 0
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <Shield className={`w-5 h-5 mb-2 ${validationType === 0 ? "text-violet-400" : "text-white/30"}`} />
                <div className={`font-medium text-sm ${validationType === 0 ? "text-violet-400" : "text-white/70"}`}>
                  Manual Approval
                </div>
                <div className="text-white/40 text-xs mt-1">
                  Validator her submission'ı manuel olarak onaylar veya reddeder.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setValidationType(1)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  validationType === 1
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <Zap className={`w-5 h-5 mb-2 ${validationType === 1 ? "text-amber-400" : "text-white/30"}`} />
                <div className={`font-medium text-sm ${validationType === 1 ? "text-amber-400" : "text-white/70"}`}>
                  Auto-Pay
                </div>
                <div className="text-white/40 text-xs mt-1">
                  Challenge süresi dolduktan sonra otomatik ödenir, itiraz olmadıkça.
                </div>
              </button>
            </div>

            {/* Challenge Period (Optimistic only) */}
            {validationType === 1 && (
              <div>
                <Label className="text-white/60 text-xs mb-1.5 block">Challenge Period (hours)</Label>
                <Input
                  type="number"
                  value={challengePeriodHours}
                  onChange={(e) => setChallengePeriodHours(e.target.value)}
                  min="1"
                  max="720"
                  className="bg-white/5 border-white/10 text-white"
                />
                <p className="text-white/30 text-xs mt-1.5">
                  Default 48 hours. Challengers can dispute within this window.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validator Address */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">
              {validationType === 0 ? "Validator / Arbitrator Address" : "Dispute Resolver Address"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={validatorAddress}
              onChange={(e) => setValidatorAddress(e.target.value)}
              placeholder="0x..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
              required
            />
            <p className="text-white/30 text-xs mt-2">
              {validationType === 0
                ? "This address can approve or reject submissions."
                : "This address resolves disputed submissions."}
            </p>
            {address && (
              <button
                type="button"
                onClick={() => setValidatorAddress(address)}
                className="text-indigo-400 hover:text-indigo-300 text-xs mt-1.5 transition-colors"
              >
                Use my address
              </button>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        {reward && taskDescription && deadline && validatorAddress && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-sm space-y-2">
            <p className="text-indigo-400 font-medium">Summary</p>
            <div className="flex justify-between text-white/60">
              <span>Reward locked</span>
              <span className="text-white">{reward} USDC</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Validation</span>
              <span className="text-white">{validationType === 0 ? "Manual Approval" : "Auto-Pay"}</span>
            </div>
            {validationType === 1 && (
              <div className="flex justify-between text-white/60">
                <span>Challenge window</span>
                <span className="text-white">{challengePeriodHours}h</span>
              </div>
            )}
          </div>
        )}

        {/* Tx pending banner */}
        {txHash && isConfirming && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/50">
            <div className="w-3 h-3 rounded-full border border-white/30 border-t-white/70 animate-spin shrink-0" />
            <span className="font-mono text-xs truncate">Confirming: {txHash}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white h-11 text-base"
          disabled={isBusy}
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Post Bounty"}
        </Button>
      </form>
    </div>
  );
}
