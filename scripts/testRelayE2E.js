/**
 * testRelayE2E.js
 *
 * Step 1 (spoke): Call bridgeClaimRelay() on a CrossChainSender → emits BridgeClaimRequested.
 *   SENDER=<addr> npx hardhat run scripts/testRelayE2E.js --network amoy
 *   SENDER=<addr> npx hardhat run scripts/testRelayE2E.js --network baseSepolia
 *
 * Step 2 (hub): Simulate BaaLS by calling mintForRelay() directly.
 *   STEP=2 SOURCE_CHAIN_ID=<id> SENDER=<spokeAddr> STAKER=<addr> AMOUNT=<wei> NONCE=<n> \
 *     npx hardhat run scripts/testRelayE2E.js --network arbitrumSepolia
 */
const hre = require("hardhat");

const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const RESURGE_TOKEN      = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  log(`Signer: ${signer.address}  Step: ${step}  Network: ${hre.network.name}`);

  if (step === 1) {
    const senderAddr = process.env.SENDER;
    if (!senderAddr) throw new Error("Set SENDER env var to CrossChainSender address");

    const sender = await hre.ethers.getContractAt("CrossChainSender", senderAddr, signer);
    const sourceChainId = (await hre.ethers.provider.getNetwork()).chainId;

    const staker = process.env.STAKER || signer.address;
    const amount = process.env.AMOUNT ? BigInt(process.env.AMOUNT) : hre.ethers.parseEther("100");

    log(`CrossChainSender: ${senderAddr}`);
    log(`Staker: ${staker}  Amount: ${hre.ethers.formatEther(amount)} RESURGE`);
    log(`relayEnabled: ${await sender.relayEnabled()}`);
    log(`authorizedCallers[signer]: ${await sender.authorizedCallers(signer.address)}`);

    log("Calling bridgeClaimRelay...");
    const tx = await sender.bridgeClaimRelay(staker, amount);
    const receipt = await tx.wait();

    const iface = sender.interface;
    const ev = receipt.logs
      .map(l => { try { return iface.parseLog(l); } catch {} })
      .find(e => e?.name === "BridgeClaimRequested");

    if (!ev) throw new Error("BridgeClaimRequested event not found");
    log(`✅ BridgeClaimRequested emitted:`);
    log(`   staker: ${ev.args.staker}`);
    log(`   amount: ${hre.ethers.formatEther(ev.args.amount)} RESURGE`);
    log(`   nonce:  ${ev.args.nonce}`);
    log(`   tx:     ${receipt.hash}`);
    log(`\nBaaLS will pick up this event and call mintForRelay on Arbitrum Sepolia.`);
    log(`To simulate BaaLS manually (hub step):`);
    log(`  STEP=2 SOURCE_CHAIN_ID=${sourceChainId} SENDER=${senderAddr} STAKER=${ev.args.staker} AMOUNT=${ev.args.amount} NONCE=${ev.args.nonce} \\`);
    log(`    npx hardhat run scripts/testRelayE2E.js --network arbitrumSepolia`);

  } else if (step === 2) {
    const sourceChainId = process.env.SOURCE_CHAIN_ID ? BigInt(process.env.SOURCE_CHAIN_ID) : null;
    const senderAddr = process.env.SENDER;
    const staker     = process.env.STAKER;
    const amount     = process.env.AMOUNT ? BigInt(process.env.AMOUNT) : null;
    const nonce      = process.env.NONCE  ? BigInt(process.env.NONCE)  : null;
    if (sourceChainId === null || !senderAddr || !staker || amount === null || nonce === null) {
      throw new Error("Set SOURCE_CHAIN_ID, SENDER, STAKER, AMOUNT, NONCE env vars");
    }

    const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);
    const token = await hre.ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      RESURGE_TOKEN, signer
    );

    const RELAY_MINTER_ROLE = hre.ethers.id("RELAY_MINTER_ROLE");
    const hasRole = await rd.hasRole(RELAY_MINTER_ROLE, signer.address);
    log(`Signer has RELAY_MINTER_ROLE: ${hasRole}`);
    if (!hasRole) throw new Error("Signer lacks RELAY_MINTER_ROLE — run governance proposal first");

    const balBefore = await token.balanceOf(staker);
    log(`Staker RESURGE before: ${hre.ethers.formatEther(balBefore)}`);

    log(`Calling mintForRelay(${staker}, ${hre.ethers.formatEther(amount)}, ${sourceChainId}, ${senderAddr}, ${nonce})...`);
    const tx = await rd.mintForRelay(staker, amount, sourceChainId, senderAddr, nonce);
    const receipt = await tx.wait();
    log(`Tx: ${receipt.hash}`);

    const balAfter = await token.balanceOf(staker);
    log(`✅ Staker RESURGE after:  ${hre.ethers.formatEther(balAfter)}`);
    log(`   Minted: ${hre.ethers.formatEther(balAfter - balBefore)} RESURGE`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
