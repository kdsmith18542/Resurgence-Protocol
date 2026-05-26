# Phase 14 Arweave Anchoring

Date completed (UTC): 2026-05-26

## Anchored Manifest

- Manifest file:
  - `deployments/resurgence-deployment-manifest-20260526T053050Z.json`
- Manifest SHA-256:
  - `578a1684a16d3c51c128e15eac471300c25c378403655106b15e1b9b237b7887`
- Irys tx id:
  - `GUy6Qzu3PndjoXrETGnFnhafne5HwJzp76cgspRRGaMP`
- Gateway URL:
  - `https://gateway.irys.xyz/GUy6Qzu3PndjoXrETGnFnhafne5HwJzp76cgspRRGaMP`

## Command Used

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://arbitrum-sepolia.drpc.org node scripts/anchorDeploymentManifest.js
```

## Notes

- Upload network/token: `devnet` / `matic`
- Upload provider: `https://rpc-amoy.polygon.technology`
- Anchor registry updated:
  - `deployments/arweave-anchors.json`
- Manifest includes:
  - Arbitrum Sepolia hub + Amoy/Base Sepolia spoke addresses
  - ABI snapshots from `artifacts/`
  - chain snapshot metadata and contract code hashes
  - exact deployment blocks where archive state was available
  - `deployment_block: null` where exact historical state lookup was unavailable

## Superseded Anchor

- Previous tx id: `2EXRPtLBWRzwHhRgAcJCRztXS6f1vGYd6HZtRV24tPuc`
- Previous manifest: `deployments/resurgence-deployment-manifest-20260526T051922Z.json`
- Reason superseded: retained provider fallback diagnostics that were removed from the canonical manifest.
