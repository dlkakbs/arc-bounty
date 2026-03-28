"use client";

import { use, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { keccak256, toHex, formatEther } from "viem";
import { toast } from "sonner";
import { Countdown } from "@/components/Countdown";

const statusConfig = {
  0: { label: "Open", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  1: { label: "Completed", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  2: { label: "Cancelled", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const typeConfig = {
  0: { label: "Manual Approval" },
  1: { label: "Auto-Pay" },
};

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bountyId = BigInt(id);
  const { address: userAddress } = useAccount();

  const [resultText, setResultText] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  let storedTask: { title?: string; description?: string } = {};
  try { storedTask = JSON.parse(localStorage.getItem(`bounty_${id}`) ?? '{}'); } catch {}

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
    <main className="section">
      <a href="/dashboard" style={{
        color:'var(--muted)', fontSize:'0.7rem', letterSpacing:'0.1em',
        textDecoration:'none', display:'inline-flex', alignItems:'center',
        gap:'0.5rem', marginBottom:'2rem',
      }}>← BACK</a>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'2rem' }}>
        {/* Left — details */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <h1 style={{ fontFamily:'var(--sans)', fontSize:'1.75rem', fontWeight:800, color:'#fff' }}>
              {storedTask.title || `Bounty #${id}`}
            </h1>
            <span className={`badge badge-${status === 0 ? 'green' : status === 2 ? 'red' : 'muted'}`}>
              {statusInfo.label}
            </span>
            <span className="badge badge-amber">{typeInfo.label}</span>
          </div>

          <p style={{ color:'var(--muted)', fontSize:'0.8rem', marginBottom:'1.5rem' }}>
            Created by{' '}
            <a href={`/profile/${creator}`} style={{ color:'var(--amber)' }}>
              {creator.slice(0,6)}...{creator.slice(-4)}
            </a>
          </p>

          {/* Task description */}
          {storedTask.description && (
            <div className="card" style={{ marginBottom:'1.5rem' }}>
              <p className="section-label" style={{ marginBottom:'1rem' }}>// TASK DESCRIPTION</p>
              <p style={{ fontSize:'0.82rem', color:'var(--text)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                {storedTask.description}
              </p>
            </div>
          )}

          {/* Deadline */}
          <div className="card" style={{ marginBottom:'1.5rem' }}>
            <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.5rem' }}>
              {isDeadlinePassed ? 'DEADLINE PASSED' : 'TIME REMAINING'}
            </p>
            {isDeadlinePassed ? (
              <span style={{ color:'var(--red)', fontFamily:'var(--sans)', fontWeight:800 }}>Expired</span>
            ) : (
              <Countdown target={deadlineNum} className="" style={{ fontFamily:'var(--mono)', fontSize:'0.85rem', fontWeight:700, color:'#fff' }} />
            )}
            <p style={{ fontSize:'0.65rem', color:'var(--muted)', marginTop:'0.4rem' }}>
              {new Date(deadlineNum * 1000).toLocaleString()}
            </p>
          </div>

          <div className="card" style={{ marginBottom:'1.5rem' }}>
            <p className="section-label" style={{ marginBottom:'1rem' }}>// Task Hash</p>
            <code style={{ fontSize:'0.72rem', color:'var(--green)', wordBreak:'break-all' }}>
              {taskHash}
            </code>
          </div>

          {/* Optimistic info */}
          {validationType === 1 && submissions.length > 0 && (
            <div style={{
              background:'rgba(245,166,35,0.08)', border:'1px solid var(--amber-dim)',
              padding:'1rem', marginBottom:'1.5rem', fontSize:'0.75rem', color:'var(--amber)',
            }}>
              Auto-Pay: submissions auto-approve after {Math.floor(challengePeriodNum / 3600)}h unless challenged.
            </div>
          )}

          {/* Action buttons */}
          {userAddress && (
            <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
              {status === 0 && !isDeadlinePassed && !isCreator && !userSubmission && (
                isRegisteredAgent ? (
                  <button onClick={() => setShowSubmitForm(!showSubmitForm)} className="btn-primary">
                    Submit Result
                  </button>
                ) : (
                  <span style={{ color:'var(--muted)', fontSize:'0.75rem', padding:'0.7rem 1.25rem',
                    border:'1px solid var(--border)' }}>
                    Only registered agents can submit
                  </span>
                )
              )}
              {validationType === 1 && userSubmission && !userSubmission.challenged &&
               !userSubmission.approved && !userSubmission.rejected &&
               now > Number(userSubmission.submittedAt) + challengePeriodNum && (
                <button onClick={handleClaimOptimistic} disabled={isBusy} className="btn-ghost">
                  {isBusy ? 'Processing...' : 'Claim Reward'}
                </button>
              )}
            </div>
          )}

          {/* Submit form */}
          {showSubmitForm && (
            <div className="card" style={{ marginBottom:'1.5rem' }}>
              <p className="section-label" style={{ marginBottom:'1rem' }}>// Submit Result</p>
              <p style={{ color:'var(--muted)', fontSize:'0.72rem', marginBottom:'0.75rem' }}>
                Describe your result. It will be hashed (keccak256) before submission.
              </p>
              <textarea
                className="input-field"
                rows={4}
                value={resultText}
                onChange={e => setResultText(e.target.value)}
                placeholder="Describe your result or paste the output URL..."
                style={{ resize:'vertical', marginBottom:'0.75rem' }}
              />
              {resultText && (
                <p style={{ fontSize:'0.68rem', color:'var(--muted)', fontFamily:'var(--mono)', marginBottom:'0.75rem' }}>
                  Hash: {keccak256(toHex(resultText)).slice(0,20)}...
                </p>
              )}
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={handleSubmitResult} disabled={isBusy || !resultText.trim()} className="btn-primary">
                  {isBusy ? 'Submitting...' : 'Submit'}
                </button>
                <button onClick={() => setShowSubmitForm(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tx banner */}
          {txHash && (
            <div style={{
              padding:'0.75rem 1rem', marginBottom:'1.5rem', fontSize:'0.72rem',
              fontFamily:'var(--mono)', wordBreak:'break-all',
              background: isConfirmed ? 'rgba(0,229,160,0.08)' : 'var(--surface)',
              border: `1px solid ${isConfirmed ? 'var(--green)' : 'var(--border)'}`,
              color: isConfirmed ? 'var(--green)' : 'var(--muted)',
            }}>
              {isConfirmed ? '✓ Confirmed: ' : '⏳ Pending: '}{txHash}
            </div>
          )}

          {/* Submissions */}
          <p className="section-label">// Submissions ({submissions.length})</p>
          {submissions.length === 0 ? (
            <p style={{ color:'var(--muted)', fontSize:'0.75rem' }}>No submissions yet. Be the first to submit!</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
              {submissions.map((sub: any, idx: number) => {
                const isUserSub = userAddress?.toLowerCase() === sub.agent?.toLowerCase();
                const challengeExpiry = Number(sub.submittedAt) + challengePeriodNum;
                const isChallengeActive = validationType === 1 && now < challengeExpiry && !sub.challenged;
                const canChallenge = isChallengeActive && !isUserSub && userAddress;

                return (
                  <div key={idx} className="card" style={{
                    display:'grid', gridTemplateColumns:'1fr auto', gap:'1rem',
                    background: isUserSub ? 'rgba(245,166,35,0.04)' : undefined,
                    borderColor: isUserSub ? 'var(--amber-dim)' : undefined,
                  }}>
                    <div>
                      <p style={{ fontSize:'0.72rem', color:'var(--muted)', marginBottom:'0.25rem' }}>
                        <a href={`/profile/${sub.agent}`} style={{ color:'var(--amber)' }}>
                          {sub.agent?.slice(0,6)}...{sub.agent?.slice(-4)}
                        </a>
                        {isUserSub && <span style={{ color:'var(--green)', marginLeft:'0.5rem' }}>(you)</span>}
                      </p>
                      <code style={{ fontSize:'0.68rem', color:'var(--text)' }}>
                        {sub.resultHash?.slice(0,10)}...{sub.resultHash?.slice(-6)}
                      </code>
                      {validationType === 1 && isChallengeActive && (
                        <p style={{ fontSize:'0.65rem', color:'var(--amber)', marginTop:'0.25rem' }}>
                          Challenge window: {new Date(challengeExpiry * 1000).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', alignItems:'flex-end' }}>
                      {sub.approved && <span className="badge badge-green">APPROVED</span>}
                      {sub.rejected && <span className="badge badge-red">REJECTED</span>}
                      {sub.challenged && <span className="badge badge-amber">CHALLENGED</span>}
                      {!sub.approved && !sub.rejected && !sub.challenged && (
                        <span className="badge badge-muted">PENDING</span>
                      )}
                      {canChallenge && status === 0 && (
                        <button onClick={() => handleChallenge(sub.agent)} disabled={isBusy}
                          style={{ fontFamily:'var(--mono)', fontSize:'0.65rem', letterSpacing:'0.08em',
                            padding:'0.3rem 0.75rem', background:'transparent',
                            border:'1px solid var(--amber-dim)', color:'var(--amber)', cursor:'crosshair' }}>
                          {isBusy ? '...' : 'Challenge'}
                        </button>
                      )}
                      {isValidator && validationType === 0 && !sub.approved && !sub.rejected && status === 0 && (
                        <>
                          <button onClick={() => handleApprove(sub.agent)} disabled={isBusy}
                            style={{ fontFamily:'var(--mono)', fontSize:'0.65rem',
                              padding:'0.3rem 0.75rem', background:'transparent',
                              border:'1px solid var(--green)', color:'var(--green)', cursor:'crosshair' }}>
                            Approve
                          </button>
                          <button onClick={() => handleReject(sub.agent)} disabled={isBusy}
                            style={{ fontFamily:'var(--mono)', fontSize:'0.65rem',
                              padding:'0.3rem 0.75rem', background:'transparent',
                              border:'1px solid var(--red)', color:'var(--red)', cursor:'crosshair' }}>
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right — action panel */}
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', alignSelf:'start', minHeight:'172px' }}>
          <div className="card">
            <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.5rem' }}>
              REWARD
            </p>
            <p style={{ fontFamily:'var(--mono)', fontSize:'0.85rem', fontWeight:700, color:'var(--amber)' }}>
              {parseFloat(formatEther(reward)).toFixed(0)} USDC
            </p>
          </div>

          {validationType === 1 && (
            <div className="card">
              <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.5rem' }}>
                CHALLENGE PERIOD
              </p>
              <p style={{ fontSize:'0.8rem', color:'var(--text)' }}>
                {Math.floor(challengePeriodNum / 3600)}h
              </p>
            </div>
          )}

          {status === 1 && winner && winner !== '0x0000000000000000000000000000000000000000' && (
            <div className="card">
              <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.5rem' }}>
                WINNER
              </p>
              <a href={`/profile/${winner}`} style={{
                fontFamily:'var(--mono)', fontSize:'0.8rem', color:'var(--amber)', textDecoration:'none',
              }}>
                {winner.slice(0,6)}...{winner.slice(-4)}
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
