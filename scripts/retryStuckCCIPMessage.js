/**
 * retryStuckCCIPMessage.js
 *
 * Manually re-executes a FAILED CCIP message on Arbitrum Sepolia.
 * The message 0xf40c5f32 was sent from Base Sepolia before authorizeBridge
 * executed — ccipReceive reverted, leaving it in FAILED state on the OffRamp.
 *
 * Requires fetching the original Any2EVMMessage from CCIP event logs.
 *
 * Usage: npx hardhat run scripts/retryStuckCCIPMessage.js --network arbitrumSepolia
 */
const hre = require("hardhat");

// Base Sepolia → Arb Sepolia OffRamp (Chainlink CCIP v1.5)
// Source: https://docs.chain.link/ccip/directory/testnet
const OFFRAMP = "0x5d64b8c5aCA657bA09A5D9F13b476efdbDFaEbCC";
const STUCK_MSG_ID = "0xf40c5f32fcc02f5efab725f9e501cfffa2c5cc688c6019b8eabb8c804dc096db";
const BASE_SEPOLIA_SELECTOR = 10344971235874465080n;
const NEW_SENDER = "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4";
const NEW_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const DEPLOYER = "0x42060A5Fc138ee019BC3F777B51c6490A1b881f0";

const OFFRAMP_ABI = [
  "function manuallyExecute(tuple(bytes32 messageId, uint64 sourceChainSelector, bytes sender, bytes data, tuple(address token, uint256 amount)[] tokenAmounts)[] messages, uint256[][] gasLimitOverrides) external",
  "function getExecutionState(uint64 sequenceNumber) external view returns (uint8)",
  "event ExecutionStateChanged(uint64 indexed sequenceNumber, bytes32 indexed messageId, uint8 state, bytes returnData)",
  "event CCIPMessageReceived(bytes32 indexed messageId, uint64 indexed sourceChainSelector, bytes sender, bytes data)",
];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  log(`Signer: ${signer.address}`);
  log(`Looking for stuck message: ${STUCK_MSG_ID}`);

  // Find the original CCIPMessageReceived or ExecutionStateChanged event to get seqNum
  const offramp = new hre.ethers.Contract(OFFRAMP, OFFRAMP_ABI, signer);
  
  // Query ExecutionStateChanged events to find the sequence number
  const filter = offramp.filters.ExecutionStateChanged(null, STUCK_MSG_ID);
  const events = await offramp.queryFilter(filter).catch(() => []);
  
  if (events.length === 0) {
    log("No ExecutionStateChanged event found for this messageId.");
    log("The message may not have arrived yet, or the OffRamp address is wrong.");
    log("Check https://ccip.chain.link for manual execution UI.");
    return;
  }

  for (const ev of events) {
    const state = ev.args.state;
    const stateNames = ["UNTOUCHED", "IN_PROGRESS", "SUCCESS", "FAILURE"];
    log(`  seqNum: ${ev.args.sequenceNumber}, state: ${stateNames[state] || state}`);
    
    if (state === 3n || state === 3) { // FAILURE
      log("Message is in FAILURE state — eligible for manual re-execution.");
      log("Use CCIP Explorer: https://ccip.chain.link to trigger manuallyExecute.");
    } else if (state === 2n || state === 2) {
      log("Message already succeeded — nothing to do.");
    }
  }
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
