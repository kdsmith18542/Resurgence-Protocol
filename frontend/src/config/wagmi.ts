import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, polygon, polygonMumbai, arbitrum, optimism } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

const hardhatLocal = {
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
} as const;

export const config = createConfig({
  chains: [polygon, polygonMumbai, mainnet, sepolia, arbitrum, optimism, hardhatLocal],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Resurgence Protocol' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '' }),
  ],
  ssr: true,
  transports: {
    [polygon.id]: http(),
    [polygonMumbai.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [hardhatLocal.id]: http(),
  },
})
