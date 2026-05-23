import { http, createConfig } from 'wagmi'
import {
  mainnet, sepolia,
  polygon, polygonAmoy,
  arbitrum, arbitrumSepolia,
  optimism, optimismSepolia,
  bsc, bscTestnet,
  base, baseSepolia,
  avalanche, avalancheFuji,
} from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

const hardhatLocal = {
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
} as const;

export const config = createConfig({
  chains: [
    arbitrum, arbitrumSepolia,
    polygon, polygonAmoy,
    bsc, bscTestnet,
    base, baseSepolia,
    mainnet, sepolia,
    optimism, optimismSepolia,
    avalanche, avalancheFuji,
    hardhatLocal,
  ],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Resurgence Protocol' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '' }),
  ],
  ssr: true,
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
    [optimismSepolia.id]: http(),
    [avalanche.id]: http(),
    [avalancheFuji.id]: http(),
    [hardhatLocal.id]: http(),
  },
})
