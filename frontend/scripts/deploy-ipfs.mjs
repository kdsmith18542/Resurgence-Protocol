import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const outDir = resolve(process.cwd(), 'out');
const indexPath = resolve(outDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error('No out directory found. Run npm run build first.');
  process.exit(1);
}

const method = process.argv[2] || 'info';

async function deployFleek() {
  console.log('Deploying to Fleek...');
  try {
    execSync('npx @fleek-platform/cli sites deploy', { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    console.log('Fleek CLI not found. Install with: npm i -g @fleek-platform/cli');
    console.log('Then run: fleek sites init && fleek sites deploy');
  }
}

async function deployPinata() {
  console.log('Deploying to Pinata...');
  const pinataJwt = process.env.PINATA_JWT;
  const pinataGateway = process.env.PINATA_GATEWAY;

  if (!pinataJwt) {
    console.log('Set PINATA_JWT environment variable to deploy to Pinata.');
    console.log('Get one at: https://app.pinata.cloud/developers/api-keys');
    return;
  }

  try {
    execSync(
      `npx @pinata/sdk upload --pinataJwt "${pinataJwt}" --pinDir out`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
  } catch {
    console.log('Pinata SDK not available. Using manual upload approach...');
    console.log('Visit https://app.pinata.cloud to upload the out/ directory manually.');
  }
}

function printInfo() {
  console.log('\n=== IPFS Deployment Guide ===\n');
  console.log('Build output is in: out/');
  console.log('');
  console.log('Option 1: Fleek (Recommended for Next.js)');
  console.log('  1. Install: npm i -g @fleek-platform/cli');
  console.log('  2. Login:   fleek login');
  console.log('  3. Init:    fleek sites init');
  console.log('  4. Deploy:  fleek sites deploy');
  console.log('  Fleek auto-detects Next.js static export.');
  console.log('');
  console.log('Option 2: Pinata');
  console.log('  1. Create account at https://app.pinata.cloud');
  console.log('  2. Get API key + JWT from Developers > API Keys');
  console.log('  3. Upload the out/ directory via web UI or API');
  console.log('  4. Access via: https://gateway.pinata.cloud/ipfs/<CID>');
  console.log('');
  console.log('Option 3: IPFS Desktop / CLI');
  console.log('  1. Install IPFS Desktop or kubo');
  console.log('  2. ipfs add -r out/');
  console.log('  3. ipfs name publish <CID>');
  console.log('');
  console.log('Option 4: Arweave');
  console.log('  1. Install: npm i -g arweave-deploy');
  console.log('  2. Deploy:  arweave deploy-dir out --key-file wallet.json');
  console.log('');
  console.log('Run with --fleek or --pinata to attempt CLI deployment.');
}

switch (method) {
  case '--fleek': deployFleek(); break;
  case '--pinata': deployPinata(); break;
  default: printInfo(); break;
}
