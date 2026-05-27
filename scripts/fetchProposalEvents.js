const hre = require("hardhat");

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const TARGET_PROPOSAL_ID = 46846360571993993484613822599224421765116954802032087859303082758844643291359n;

  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);

  console.log("Fetching ProposalCreated events...");
  const filter = gov.filters.ProposalCreated();
  // Fetch from a reasonable block number. The proposal was created recently, say last 100,000 blocks.
  const latestBlock = await hre.ethers.provider.getBlockNumber();
  const fromBlock = latestBlock - 50000;
  
  console.log(`Searching from block ${fromBlock} to ${latestBlock}...`);
  const events = await gov.queryFilter(filter, fromBlock, latestBlock);

  console.log(`Found ${events.length} ProposalCreated events.`);

  for (const event of events) {
    const propId = event.args[0];
    const proposer = event.args[1];
    const targets = Array.from(event.args[2]);
    const values = Array.from(event.args[3]).map(v => BigInt(v.toString()));
    const calldatas = Array.from(event.args[5]);
    const description = event.args[8];
    const descHash = hre.ethers.id(description);

    const s = Number(await gov.state(propId));

    console.log("\n--- Proposal ---");
    console.log("Proposal ID:", propId.toString());
    console.log("State:", STATE_NAMES[s], `(${s})`);
    console.log("Proposer:", proposer);
    console.log("Targets:", targets);
    console.log("Values:", values.map(v => v.toString()));
    console.log("Calldatas:", calldatas);
    console.log("Description:", description);
    console.log("Description Hash (ethers.id):", descHash);

    const predecessor = hre.ethers.ZeroHash;
    
    // Solidity bytes20(address) is left-aligned in a bytes32, i.e. padded with zeros on the right.
    const govBytes20LeftAligned = hre.ethers.zeroPadBytes(hre.ethers.getBytes(GOVERNANCE_ADDRESS), 32); 
    const salt = bytesXor(govBytes20LeftAligned, descHash);

    const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
    const tl = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK, signer);

    const opId = await tl.hashOperationBatch(targets, values, calldatas, predecessor, salt);
    console.log("Computed Operation ID:", opId);

    const isOp = await tl.isOperation(opId);
    const isPending = await tl.isOperationPending(opId);
    const isReady = await tl.isOperationReady(opId);
    const isDone = await tl.isOperationDone(opId);

    console.log("isOperation:", isOp);
    console.log("isOperationPending:", isPending);
    console.log("isOperationReady:", isReady);
    console.log("isOperationDone:", isDone);
  }
}

function bytesXor(a, b) {
  const bufA = Buffer.from(hre.ethers.getBytes(a));
  const bufB = Buffer.from(hre.ethers.getBytes(b));
  const res = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    res[i] = bufA[i] ^ bufB[i];
  }
  return hre.ethers.hexlify(res);
}

main().catch(console.error);
