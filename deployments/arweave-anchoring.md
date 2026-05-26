# Phase 14 Arweave Anchoring

Date completed (UTC): 2026-05-26

## Anchored Manifest

- Manifest file:
  - `deployments/resurgence-deployment-manifest-20260526T051922Z.json`
- Manifest SHA-256:
  - `c71358a47210939a03900afeb2a61ba2f3bf20bfbeca9eca27f4f97653865323`
- Irys tx id:
  - `2EXRPtLBWRzwHhRgAcJCRztXS6f1vGYd6HZtRV24tPuc`
- Gateway URL:
  - `https://gateway.irys.xyz/2EXRPtLBWRzwHhRgAcJCRztXS6f1vGYd6HZtRV24tPuc`

## Command Used

```bash
node scripts/anchorDeploymentManifest.js
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
  - deployment block lookup metadata (with graceful fallback on non-archive RPC)
