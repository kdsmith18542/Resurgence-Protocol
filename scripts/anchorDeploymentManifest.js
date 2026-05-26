#!/usr/bin/env node
/**
 * anchorDeploymentManifest.js
 *
 * Phase 14 helper:
 * 1) Assemble the current v4 testnet deployment manifest
 *    (Arbitrum Sepolia hub + Amoy/Base Sepolia spokes)
 * 2) Include chain snapshots, contract ABIs, and first-seen code block numbers
 * 3) Upload manifest JSON to Irys
 * 4) Append tx metadata to deployments/arweave-anchors.json
 *
 * Usage:
 *   node scripts/anchorDeploymentManifest.js
 *   node scripts/anchorDeploymentManifest.js --no-upload
 *
 * Optional env:
 *   MANIFEST_OUTPUT_DIR=deployments
 *   ANCHORS_FILE=deployments/arweave-anchors.json
 *   IRYS_NETWORK=devnet
 *   IRYS_TOKEN=matic
 *   IRYS_PROVIDER_URL=https://rpc-amoy.polygon.technology
 *   IRYS_NODE_URL=https://devnet.irys.xyz
 *   IRYS_TOPUP_MULTIPLIER=1.1
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const { ethers } = require("ethers");
const Irys = require("@irys/sdk").default;

const ROOT_DIR = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(ROOT_DIR, process.env.MANIFEST_OUTPUT_DIR || "deployments");
const ANCHORS_FILE = path.resolve(ROOT_DIR, process.env.ANCHORS_FILE || "deployments/arweave-anchors.json");
const NO_UPLOAD = process.argv.includes("--no-upload") || process.env.NO_UPLOAD === "1";

const IRYS_NETWORK = process.env.IRYS_NETWORK || "devnet";
const IRYS_TOKEN = process.env.IRYS_TOKEN || "matic";
const IRYS_PROVIDER_URL = process.env.IRYS_PROVIDER_URL || process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const IRYS_NODE_URL = process.env.IRYS_NODE_URL || "https://devnet.irys.xyz";
const IRYS_TOPUP_MULTIPLIER = Number(process.env.IRYS_TOPUP_MULTIPLIER || "1.1");

const CHAIN_CONFIG = [
  {
    key: "arbitrum_sepolia",
    label: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://arbitrum-sepolia.drpc.org",
    contracts: [
      { name: "ResurgeToken", address: "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0", artifact: "contracts/ResurgeToken.sol/ResurgeToken.json" },
      { name: "TimelockController", address: "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87", artifact: "contracts/ResurgenceTimelockController.sol/ResurgenceTimelockController.json" },
      { name: "RewardDistributor", address: "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed", artifact: "contracts/RewardDistributor.sol/RewardDistributor.json" },
      { name: "StakingPoolManager", address: "0x885288A3238d47D675AC9220EFc71FBE5bfc23dd", artifact: "contracts/StakingPoolManager.sol/StakingPoolManager.json" },
      { name: "ResurgeStakingPool", address: "0xC4e5fC1207c74554837E7259a2F410E33567afAD", artifact: "contracts/ResurgeStakingPool.sol/ResurgeStakingPool.json" },
      { name: "ResurgenceGovernance", address: "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B", artifact: "contracts/ResurgenceGovernance.sol/ResurgenceGovernance.json" },
      { name: "CrossChainReceiverV2", address: "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F", artifact: "contracts/CrossChainReceiver.sol/CrossChainReceiver.json" },
      { name: "CrossChainReceiverV1Legacy", address: "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB", artifact: "contracts/CrossChainReceiver.sol/CrossChainReceiver.json" },
      { name: "NonEvmStakingPoolImplementation", address: "0xa4cBbe489B24cf657aAB78a268435703C478a0BD", artifact: "contracts/NonEvmStakingPool.sol/NonEvmStakingPool.json" },
      { name: "NonEvmStakingPoolProxy", address: "0x1Eeb1269EB0511Db788bB72668E8AD0084819591", artifact: "contracts/NonEvmStakingPool.sol/NonEvmStakingPool.json" },
    ],
  },
  {
    key: "polygon_amoy",
    label: "Polygon Amoy",
    chainId: 80002,
    rpcUrl: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    contracts: [
      { name: "ResurgenceTimelockController", address: "0xcce434614eC41f170Ca05a6bfaC9445bdDC58FA3", artifact: "contracts/ResurgenceTimelockController.sol/ResurgenceTimelockController.json" },
      { name: "CrossChainSenderRelay", address: "0xD41086DA2acCcD4EFfd47FA69ED3E6f71d9da5C6", artifact: "contracts/CrossChainSender.sol/CrossChainSender.json" },
      { name: "CrossChainSenderCcip", address: "0x3F1E0400fb8f19FeFA8aA6B8d23468949E73a7B5", artifact: "contracts/CrossChainSender.sol/CrossChainSender.json" },
      { name: "StakingPoolManager", address: "0xbc6d675069c57a1c039a4f0be0979cb6e6727a9b", artifact: "contracts/StakingPoolManager.sol/StakingPoolManager.json" },
      { name: "DeadCoinStakingPoolActive", address: "0xA47464986848447Efa93EF0Cd1b20a1a6227922D", artifact: "contracts/DeadCoinStakingPool.sol/DeadCoinStakingPool.json" },
      { name: "DeadCoinDeadtestActive", address: "0xc83702C54Ce1Cdb5C2A9ca3bbdc30e023859019A", artifact: "contracts/ERC20Mock.sol/ERC20Mock.json" },
    ],
  },
  {
    key: "base_sepolia",
    label: "Base Sepolia",
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",
    contracts: [
      { name: "CrossChainSenderRelay", address: "0xF38940C9Eb607521ba657AE1bd86328AD09712ea", artifact: "contracts/CrossChainSender.sol/CrossChainSender.json" },
      { name: "CrossChainSenderCcip", address: "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4", artifact: "contracts/CrossChainSender.sol/CrossChainSender.json" },
      { name: "DeadCoinStakingPoolDeadbaseRelay", address: "0xB4BabB6b1E8E60A9b4EDa85296701Fe5906b2982", artifact: "contracts/DeadCoinStakingPool.sol/DeadCoinStakingPool.json" },
      { name: "DeadCoinDeadbase", address: "0x5113D208E6C38AEAd715caa0cee1D26B1b8eA2B9", artifact: "contracts/ERC20Mock.sol/ERC20Mock.json" },
      { name: "ResurgeStubToken", address: "0xB19BaeF4995A5DD6d50797928053789D20008B46", artifact: "contracts/ERC20Mock.sol/ERC20Mock.json" },
    ],
  },
];

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function fail(msg) {
  throw new Error(msg);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function loadArtifactAbi(relativeArtifactPath) {
  const fullPath = path.join(ROOT_DIR, "artifacts", relativeArtifactPath);
  if (!fs.existsSync(fullPath)) {
    fail(`Artifact not found: ${fullPath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return parsed.abi;
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function timestampSlug(isoUtc) {
  return isoUtc.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "T");
}

async function findFirstCodeBlock(provider, address, latestBlock) {
  try {
    const atLatest = await provider.getCode(address, latestBlock);
    if (!atLatest || atLatest === "0x") return null;
  } catch (err) {
    return null;
  }

  let low = 0;
  let high = latestBlock;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    try {
      const code = await provider.getCode(address, mid);
      if (code && code !== "0x") {
        high = mid;
      } else {
        low = mid + 1;
      }
    } catch (err) {
      return null;
    }
  }
  return low;
}

async function collectChainSection(chainCfg, abiCache) {
  const provider = new ethers.JsonRpcProvider(chainCfg.rpcUrl);
  const network = await provider.getNetwork();
  const latestBlockNumber = await provider.getBlockNumber();
  const latestBlock = await provider.getBlock(latestBlockNumber);
  if (!latestBlock) fail(`Could not read latest block on ${chainCfg.label}`);

  const contracts = [];
  for (const c of chainCfg.contracts) {
    const checksumAddress = ethers.getAddress(c.address);
    const code = await provider.getCode(checksumAddress);
    if (!code || code === "0x") {
      fail(`${chainCfg.label}: no contract code at ${checksumAddress} (${c.name})`);
    }

    const deploymentBlock = await findFirstCodeBlock(provider, checksumAddress, latestBlockNumber);
    const codeHash = ethers.keccak256(code);
    const codeSizeBytes = Math.max(0, Math.floor((code.length - 2) / 2));

    if (!abiCache[c.artifact]) {
      abiCache[c.artifact] = loadArtifactAbi(c.artifact);
    }

    contracts.push({
      name: c.name,
      address: checksumAddress,
      artifact_path: `artifacts/${c.artifact}`,
      deployment_block: deploymentBlock,
      code_hash: codeHash,
      code_size_bytes: codeSizeBytes,
      abi: abiCache[c.artifact],
    });
  }

  return {
    chain_key: chainCfg.key,
    chain_label: chainCfg.label,
    expected_chain_id: chainCfg.chainId,
    observed_chain_id: Number(network.chainId),
    rpc_url: chainCfg.rpcUrl,
    latest_block_number: latestBlockNumber,
    latest_block_hash: latestBlock.hash,
    latest_block_timestamp_utc: new Date(latestBlock.timestamp * 1000).toISOString(),
    contracts,
  };
}

function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function readAnchorsFileOrDefault() {
  if (!fs.existsSync(ANCHORS_FILE)) {
    return {
      schema_version: "resurgence:arweave-anchors:v1",
      anchors: [],
    };
  }
  return JSON.parse(fs.readFileSync(ANCHORS_FILE, "utf8"));
}

async function uploadToIrys(manifestRaw, manifestPath, manifestSha256) {
  const privateKey = process.env.IRYS_WALLET || process.env.PRIVATE_KEY;
  if (!privateKey) fail("IRYS_WALLET or PRIVATE_KEY is required for upload");

  const irys = new Irys({
    url: IRYS_NODE_URL,
    network: IRYS_NETWORK,
    token: IRYS_TOKEN,
    key: privateKey,
    config: { providerUrl: IRYS_PROVIDER_URL },
  });
  await irys.ready();

  const sizeBytes = Buffer.byteLength(manifestRaw);
  const balanceAtomic = await irys.getLoadedBalance();
  const priceAtomic = await irys.getPrice(sizeBytes);

  log(`Irys wallet: ${irys.address}`);
  log(`Irys token/network: ${IRYS_TOKEN}/${IRYS_NETWORK}`);
  log(`Manifest size: ${sizeBytes} bytes`);
  log(`Upload price: ${irys.utils.fromAtomic(priceAtomic).toString()} ${IRYS_TOKEN} (${priceAtomic.toString()} atomic)`);
  log(`Loaded balance: ${irys.utils.fromAtomic(balanceAtomic).toString()} ${IRYS_TOKEN} (${balanceAtomic.toString()} atomic)`);

  if (balanceAtomic.isLessThan(priceAtomic)) {
    const missingAtomic = priceAtomic.minus(balanceAtomic);
    const topupAtomic = missingAtomic.multipliedBy(IRYS_TOPUP_MULTIPLIER).integerValue();
    log(`Funding Irys balance with ${irys.utils.fromAtomic(topupAtomic).toString()} ${IRYS_TOKEN}...`);
    const fundTx = await irys.fund(topupAtomic.toString(), 1.2);
    log(`Fund tx id: ${fundTx.id}`);
  }

  const tags = [
    { name: "App-Name", value: "Resurgence-Protocol" },
    { name: "Type", value: "deployment-manifest" },
    { name: "Content-Type", value: "application/json" },
    { name: "Schema-Version", value: "resurgence:deployment-anchor:v1" },
    { name: "Manifest-SHA256", value: manifestSha256 },
    { name: "Manifest-Path", value: path.relative(ROOT_DIR, manifestPath) },
  ];

  const receipt = await irys.upload(manifestRaw, { tags });
  log(`Uploaded to https://gateway.irys.xyz/${receipt.id}`);
  return receipt.id;
}

async function main() {
  const startedAtUtc = new Date().toISOString();
  ensureDir(OUT_DIR);

  const abiCache = {};
  const chainSections = [];
  for (const chainCfg of CHAIN_CONFIG) {
    log(`Collecting chain snapshot: ${chainCfg.label}`);
    const section = await collectChainSection(chainCfg, abiCache);
    chainSections.push(section);
  }

  const manifest = {
    schema_version: "resurgence:deployment-anchor:v1",
    generated_at_utc: startedAtUtc,
    repository: "https://github.com/kdsmith18542/Resurgence-Protocol",
    git_commit: getGitCommit(),
    phase: "14",
    description: "v4 testnet deployment snapshot for Arbitrum Sepolia hub + Amoy/Base Sepolia spokes",
    chains: chainSections,
  };

  const slug = timestampSlug(startedAtUtc);
  const manifestPath = path.join(OUT_DIR, `resurgence-deployment-manifest-${slug}.json`);
  const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(manifestPath, manifestRaw, "utf8");
  const manifestSha256 = sha256Hex(manifestRaw);

  let txId = null;
  if (!NO_UPLOAD) {
    txId = await uploadToIrys(manifestRaw, manifestPath, manifestSha256);
  } else {
    log("Upload skipped (--no-upload)");
  }

  const anchors = readAnchorsFileOrDefault();
  if (anchors.schema_version !== "resurgence:arweave-anchors:v1") {
    fail(`Unexpected anchors schema: ${anchors.schema_version}`);
  }
  anchors.anchors.push({
    timestamp_utc: startedAtUtc,
    status: txId ? "uploaded" : "generated",
    tx_id: txId,
    manifest_path: path.relative(ROOT_DIR, manifestPath),
    manifest_sha256: manifestSha256,
    irys_network: IRYS_NETWORK,
    irys_token: IRYS_TOKEN,
    irys_provider_url: IRYS_PROVIDER_URL,
    gateway_url: txId ? `https://gateway.irys.xyz/${txId}` : null,
  });

  ensureDir(path.dirname(ANCHORS_FILE));
  fs.writeFileSync(ANCHORS_FILE, `${JSON.stringify(anchors, null, 2)}\n`, "utf8");

  log(`Manifest file: ${manifestPath}`);
  log(`Manifest SHA-256: ${manifestSha256}`);
  log(`Anchors file: ${ANCHORS_FILE}`);
  if (txId) log(`Arweave/Irys tx id: ${txId}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
});
