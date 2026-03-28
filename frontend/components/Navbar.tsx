"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: '/dashboard',   label: 'Dashboard'   },
  { href: '/bounties',    label: 'Bounties'    },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/create',      label: 'Post Task'   },
];

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
        <ConnectButton />
      </div>
    </nav>
  );
}
