"use client";

import { use, useState, useEffect } from "react";
import { useReadContract, useReadContracts, useAccount, usePublicClient } from "wagmi";
import { BOUNTY_REGISTRY_ADDRESS, BOUNTY_REGISTRY_ABI } from "@/lib/contract";
import { formatEther } from "viem";
import { toast } from "sonner";

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address: agentAddress } = use(params);
  const { address: connectedWallet } = useAccount();
  const publicClient = usePublicClient();

  const [copied, setCopied] = useState(false);
  const [resultTexts, setResultTexts] = useState<Record<string, string>>({});

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(agentAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch all ResultSubmitted events (no args filter for RPC compat), filter in JS
  useEffect(() => {
    if (!publicClient) return;
    publicClient.getLogs({
      address: BOUNTY_REGISTRY_ADDRESS,
      event: {
        type: "event",
        name: "ResultSubmitted",
        inputs: [
          { name: "bountyId",   type: "uint256", indexed: true },
          { name: "agent",      type: "address", indexed: true },
          { name: "resultHash", type: "bytes32", indexed: false },
          { name: "result",     type: "string",  indexed: false },
        ],
      } as const,
      fromBlock: BigInt(0),
    }).then((logs) => {
      const map: Record<string, string> = {};
      for (const log of logs) {
        const agent    = ((log.args as any).agent as string)?.toLowerCase();
        const bountyId = String((log.args as any).bountyId);
        const result   = (log.args as any).result as string;
        if (agent === agentAddress.toLowerCase() && bountyId && result) {
          map[bountyId] = result;
        }
      }
      setResultTexts(map);
    }).catch(() => {});
  }, [publicClient, agentAddress]);

  const { data: statsRaw } = useReadContract({
    address: BOUNTY_REGISTRY_ADDRESS,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "agentStats",
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
  const completed  = stats ? BigInt(stats[0]) : BigInt(0);
  const attempted  = stats ? BigInt(stats[1]) : BigInt(0);
  const totalEarned = stats ? BigInt(stats[2]) : BigInt(0);

  // Bounty struct indices (after title+description addition):
  // [0]=creator [1]=title [2]=description [3]=taskHash [4]=reward
  // [5]=deadline [6]=challengePeriod [7]=validationType [8]=validator [9]=status [10]=winner
  const participatedBounties = ids
    .map((id) => {
      const idx        = Number(id) - 1;
      const bounty     = (bountyData?.[idx]?.result as any) ?? null;
      const submissions = (submissionData?.[idx]?.result as any[]) ?? [];
      const agentSub   = submissions.find(
        (s: any) => s.agent?.toLowerCase() === agentAddress.toLowerCase()
      );
      if (!agentSub || !bounty) return null;
      return { id, bounty, submission: agentSub };
    })
    .filter(Boolean) as { id: bigint; bounty: any; submission: any }[];

  return (
    <main className="section">
      <a href="/leaderboard" style={{
        color:'var(--muted)', fontSize:'0.7rem', letterSpacing:'0.1em',
        textDecoration:'none', marginBottom:'2rem', display:'inline-block',
      }}>← LEADERBOARD</a>

      {/* Agent header */}
      <div className="card" style={{
        display:'grid', gridTemplateColumns:'1fr auto',
        alignItems:'center', marginBottom:'2rem',
      }}>
        <div>
          <p style={{ fontSize:'0.6rem', letterSpacing:'0.15em', color:'var(--muted)', marginBottom:'0.4rem' }}>
            AGENT ADDRESS
          </p>
          <button onClick={handleCopyAddress} style={{
            background:'none', border:'none', cursor:'crosshair', padding:0,
            fontFamily:'var(--mono)', fontSize:'0.9rem', color:'#fff', wordBreak:'break-all', textAlign:'left',
          }}>
            {agentAddress}
          </button>
          {copied && <p style={{ fontSize:'0.65rem', color:'var(--green)', marginTop:'0.25rem' }}>Copied!</p>}
        </div>
        <span className="badge badge-green">REGISTERED</span>
      </div>

      {/* Stats */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:1, background:'var(--border)', marginBottom:'2rem',
      }}>
        {[
          { val: completed.toString(),                                   label:'Completed', color:'var(--green)' },
          { val: attempted.toString(),                                   label:'Attempted', color:'var(--text)'  },
          { val: `$${parseFloat(formatEther(totalEarned)).toFixed(0)}`, label:'Earned',    color:'var(--amber)' },
        ].map(({ val, label, color }) => (
          <div key={label} style={{ background:'var(--surface)', padding:'2rem', textAlign:'center' }}>
            <span style={{ fontFamily:'var(--sans)', fontSize:'2rem', fontWeight:800,
              color, display:'block', marginBottom:'0.3rem' }}>{val}</span>
            <span style={{ fontSize:'0.62rem', letterSpacing:'0.15em',
              textTransform:'uppercase', color:'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Participation history */}
      <p className="section-label">// Bounty Participation</p>
      {participatedBounties.length === 0 ? (
        <p style={{ color:'var(--muted)', fontSize:'0.75rem' }}>No submissions yet.</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
          {participatedBounties.map(({ id, bounty, submission }) => {
            const reward    = BigInt(bounty[4] ?? 0);
            const creator   = bounty[0] as string;
            const title     = (bounty[1] as string) || `Bounty #${Number(id)}`;
            const winner    = bounty[10] as string;
            const isWinner  = winner?.toLowerCase() === agentAddress.toLowerCase();
            const isApproved = submission.approved;
            const isRejected = submission.rejected;
            const isChallenged = submission.challenged;

            const statusLabel = isWinner || isApproved ? 'WINNER'
              : isRejected   ? 'REJECTED'
              : isChallenged ? 'CHALLENGED'
              : 'PENDING';
            const badgeColor = isWinner || isApproved ? 'blue'
              : isRejected ? 'red'
              : isChallenged ? 'amber'
              : 'muted';

            // Result text is only visible to the bounty creator
            const isCreator = connectedWallet?.toLowerCase() === creator?.toLowerCase();
            const resultText = resultTexts[String(id)];

            return (
              <div key={id.toString()} className="card">
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:'1rem', alignItems:'center', marginBottom: isCreator && resultText ? '0.75rem' : 0 }}>
                  <div>
                    <a href={`/bounties/${id}`} style={{ color:'#fff', fontSize:'0.82rem', textDecoration:'none' }}>
                      {title}
                    </a>
                    <p style={{ fontSize:'0.65rem', color:'var(--muted)', marginTop:'0.2rem', fontFamily:'var(--mono)' }}>
                      {submission.resultHash?.slice(0,12)}...
                    </p>
                  </div>
                  <span style={{ fontSize:'0.75rem', color:'var(--amber)', fontFamily:'var(--mono)', fontWeight:700 }}>
                    ${parseFloat(formatEther(reward)).toFixed(0)} USDC
                  </span>
                  <span className={`badge badge-${badgeColor}`}>{statusLabel}</span>
                </div>

                {/* Result text — only visible to the bounty creator */}
                {isCreator && resultText && (
                  <div style={{
                    borderTop:'1px solid var(--border)', paddingTop:'0.75rem',
                    marginTop:'0.5rem',
                  }}>
                    <p style={{ fontSize:'0.6rem', letterSpacing:'0.12em', color:'var(--amber)',
                      textTransform:'uppercase', marginBottom:'0.5rem' }}>
                      // Result (visible only to you as task creator)
                    </p>
                    <pre style={{
                      fontSize:'0.7rem', color:'var(--text)', lineHeight:1.7,
                      whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0,
                      fontFamily:'var(--mono)',
                    }}>
                      {resultText}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
