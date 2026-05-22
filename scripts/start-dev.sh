#!/usr/bin/env bash
set -e

# Resurgence Protocol - Local Development Startup
# Starts: Hardhat node -> Deploy contracts -> Frontend dev server

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || true

cleanup() {
  echo "Shutting down..."
  [ -n "$HARDHAT_PID" ] && kill "$HARDHAT_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup EXIT INT TERM

echo "=============================="
echo " Resurgence Protocol - Local Dev"
echo "=============================="

# 1. Start Hardhat node
echo ""
echo "[1/4] Starting Hardhat node..."
npx hardhat node > /tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
echo "  PID: $HARDHAT_PID"

# Wait for Hardhat node to be ready
echo "  Waiting for node..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:8545; then
    echo "  Hardhat node ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "  ERROR: Hardhat node failed to start"
    cat /tmp/hardhat-node.log
    exit 1
  fi
  sleep 1
done

# 2. Deploy contracts with local dev script
echo ""
echo "[2/4] Deploying contracts..."
npx hardhat run scripts/deployLocalDev.js --network localhost 2>&1 | tee /tmp/deploy-output.log

# Extract addresses
TOKEN_ADDR=$(grep "ResurgeToken (proxy):" /tmp/deploy-output.log | awk '{print $NF}')
TIMELOCK_ADDR=$(grep "TimelockController:" /tmp/deploy-output.log | awk '{print $NF}')
RD_ADDR=$(grep "RewardDistributor (proxy):" /tmp/deploy-output.log | awk '{print $NF}')
MGR_ADDR=$(grep "StakingPoolManager (proxy):" /tmp/deploy-output.log | awk '{print $NF}')
GOV_ADDR=$(grep "ResurgenceGovernance:" /tmp/deploy-output.log | awk '{print $NF}')

echo ""
echo "  Deployed addresses:"
echo "  ResurgeToken:        $TOKEN_ADDR"
echo "  Timelock:            $TIMELOCK_ADDR"
echo "  RewardDistributor:   $RD_ADDR"
echo "  StakingPoolManager:  $MGR_ADDR"
echo "  Governance:          $GOV_ADDR"

# 3. Create .env.local for frontend
echo ""
echo "[3/4] Writing frontend/.env.local..."
cat > "$FRONTEND_DIR/.env.local" << EOF
NEXT_PUBLIC_SUBGRAPH_URL=http://localhost:3000/api/subgraph
NEXT_PUBLIC_WC_PROJECT_ID=local-dev-placeholder
NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS=$TOKEN_ADDR
NEXT_PUBLIC_TIMELOCK_ADDRESS=$TIMELOCK_ADDR
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=$RD_ADDR
NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS=$MGR_ADDR
NEXT_PUBLIC_GOVERNANCE_ADDRESS=$GOV_ADDR
NEXT_PUBLIC_DEFAULT_CHAIN_ID=31337
EOF
echo "  Done"

# 4. Start frontend dev server
echo ""
echo "[4/4] Starting frontend dev server..."
cd "$FRONTEND_DIR"
npx next dev -p 3000 &
FRONTEND_PID=$!
echo "  PID: $FRONTEND_PID"

echo ""
echo "=============================="
echo "  Local dev environment ready!"
echo "  Frontend: http://localhost:3000"
echo "  RPC:      http://127.0.0.1:8545"
echo "  Chain ID: 31337 (Hardhat)"
echo ""
echo "  Test account (admin):"
echo "    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "    PK: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "=============================="

# Wait for either process to exit
wait
