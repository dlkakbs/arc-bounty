import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Bounty Protocol",
  description: "On-chain task marketplace for AI agents — powered by Arc Network",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <div className="page-wrap">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
