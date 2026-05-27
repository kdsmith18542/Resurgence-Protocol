const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const targetSelector = "0xd6bda275";
  console.log("Searching for selector:", targetSelector);

  // Read artifacts
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  if (!fs.existsSync(artifactsDir)) {
    console.log("Artifacts directory not found.");
    return;
  }

  function walk(dir) {
    let files = fs.readdirSync(dir);
    for (let file of files) {
      let fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith(".json") && !file.endsWith(".dbg.json")) {
        const content = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const abi = content.abi;
        if (!abi) continue;
        for (let item of abi) {
          if (item.type === "error") {
            const signature = `${item.name}(${item.inputs.map(i => i.type).join(",")})`;
            const selector = hre.ethers.id(signature).substring(0, 10);
            if (selector === targetSelector) {
              console.log(`Found match in ${content.contractName}:`);
              console.log(`  Signature: ${signature}`);
              console.log(`  Selector: ${selector}`);
            }
          }
        }
      }
    }
  }

  walk(artifactsDir);
}

main().catch(console.error);
