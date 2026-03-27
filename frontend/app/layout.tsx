import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#080810] text-white min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
