const hre = require("hardhat");
async function main() {
  const EXISTING_POOL   = "0xAa0510C739B14DaC10Df4EfbD1C093D3bd2662Ac";
  const EXISTING_SENDER = "0x8beabf9277E21ee269e9b192D3b00d041aaCc6dd";
  const NEW_POOL        = "0xF38940C9Eb607521ba657AE1bd86328AD09712ea";
  const NEW_SENDER      = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";

  const DCSP = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const CCS  = await hre.ethers.getContractFactory("CrossChainSender");

  for (const [label, poolAddr, senderAddr] of [
    ["existing", EXISTING_POOL, EXISTING_SENDER],
    ["new",      NEW_POOL,      NEW_SENDER],
  ]) {
    const pool = DCSP.attach(poolAddr);
    const sender = CCS.attach(senderAddr);
    const poolSender  = await pool.crossChainSender().catch(() => "ERR");
    const deadCoin    = await pool.deadCoin().catch(() => "ERR");
    const isAuthPool  = await sender.authorizedCallers(poolAddr).catch(() => "ERR");
    console.log(`[${label}] pool=${poolAddr.slice(0,10)} sender=${senderAddr.slice(0,10)}`);
    console.log(`  pool.crossChainSender = ${poolSender}`);
    console.log(`  pool.deadCoin         = ${deadCoin}`);
    console.log(`  sender.authorizedCallers[pool] = ${isAuthPool}`);
  }
}
main().catch(console.error);
