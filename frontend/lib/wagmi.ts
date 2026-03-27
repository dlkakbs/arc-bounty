import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arcTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Bounty Protocol",
  projectId: "abp-arc-testnet",
  chains: [arcTestnet],
  ssr: true,
});
