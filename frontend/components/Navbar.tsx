"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: '/dashboard',   label: 'Bounties'    },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/register',    label: 'Register'    },
  { href: '/create',      label: 'Post Task'   },
];

const btnStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase',
  padding: '0.45rem 1rem',
  background: 'transparent', color: 'var(--amber)',
  border: '1px solid var(--amber)', cursor: 'crosshair',
  transition: 'background 0.2s',
};

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', height: 56,
      borderBottom: '1px solid var(--border)',
      background: 'rgba(8,11,15,0.88)',
      backdropFilter: 'blur(12px)',
    }}>
      <a href="/" style={{
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '0.95rem',
        letterSpacing: '0.1em', color: 'var(--amber)', textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--green)',
          display: 'inline-block',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        BOUNTY AI
      </a>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} style={{
            color: pathname === href ? 'var(--amber)' : 'var(--muted)',
            textDecoration: 'none',
            fontSize: '0.72rem', letterSpacing: '0.12em',
            textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}>
            {label}
          </Link>
        ))}

        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div {...(!mounted && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}>
                {!connected ? (
                  <button onClick={openConnectModal} style={btnStyle}>
                    Connect Wallet
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={openChainModal} style={{ ...btnStyle, fontSize: '0.65rem' }}>
                      {chain.name}
                    </button>
                    <button onClick={openAccountModal} style={btnStyle}>
                      {account.displayName}
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </nav>
  );
}
