import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Resurgence Protocol' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '' }),
  ],
  ssr: true,
  transports: {
    mainnet: http(),
    sepolia: http(),
  },
}) 