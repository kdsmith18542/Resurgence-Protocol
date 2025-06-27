# Resurgence Protocol

A smart contract project for decentralized staking and rewards.

## Project Structure

- `contracts/` - Smart contract source files
- `test/` - Test files for smart contracts
- `scripts/` - Deployment and utility scripts
- `frontend/` - Frontend application (if applicable)
- `docs/` - Project documentation

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Hardhat

## Installation

1. Clone the repository:
   ```bash
   git clone https://gitlab.com/grywrm1337/resurgence-protocol.git
   cd resurgence-protocol
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

### Testing

Run the test suite:
```bash
npx hardhat test
```

### Deployment

1. Configure your environment variables in `.env`
2. Run the deployment script:
   ```bash
   npx hardhat run scripts/deploy.js --network <network-name>
   ```

## License

ISC
