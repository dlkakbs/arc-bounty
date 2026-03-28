"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  target: number; // unix timestamp (seconds)
  className?: string;
  style?: React.CSSProperties;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown({ target, className, style }: CountdownProps) {
  const [diff, setDiff] = useState(target - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setDiff(target - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (diff <= 0) return <span className={className}>Expired</span>;

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return (
    <span className={className} style={style}>
      {d > 0 && `${d}d `}{pad(h)}h {pad(m)}m {pad(s)}s
    </span>
  );
}
