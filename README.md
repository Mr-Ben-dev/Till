# Till

**Give an agent a Till. It can pay and finish work. It cannot empty you.**

Till is a permissioned spend account for autonomous agents on [0G Aristotle](https://chainscan.0g.ai) (chain ID **16661**). The agent can buy the intelligence it needs. It cannot empty you.

- App: https://till-0g.vercel.app
- API: https://till-api.onrender.com
- Repo: https://github.com/Mr-Ben-dev/Till

No shared operator wallet. No mock TEE. No OpenAI/Groq fallback.

## Before you pay

Paste a token, contract, protocol, wallet, or vendor. The agent quotes real x402 checks, 0G Compute verifies privately, then you get **BUY / HOLD / AVOID** with spend and on-chain proof.

## Production contracts (Aristotle 16661)

| Contract | Address |
|---|---|
| TillAgentNFT | [`0x730e7c02D1C238D98aD38AFED98a7CBA980901bF`](https://chainscan.0g.ai/address/0x730e7c02D1C238D98aD38AFED98a7CBA980901bF) |
| TillPolicy | [`0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c`](https://chainscan.0g.ai/address/0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c) |
| TillVerifier | [`0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1`](https://chainscan.0g.ai/address/0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1) |
| TillVault | [`0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB`](https://chainscan.0g.ai/address/0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB) |
| TillJobEscrow | [`0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9`](https://chainscan.0g.ai/address/0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9) |

ERC-7857 `supportsInterface`: `0x80ac58cd` `0x2afbede9` `0xdf597d99` `0x74f8628b`.

Verify a payment: open `/verify` and paste a tx hash. No wallet required.

## Layout

```text
apps/web            React + Vite + Privy
apps/api            Fastify (Compute, x402, Storage, verify)
apps/demo-402       Local x402 rehearsal only
packages/contracts  Foundry
packages/sdk
packages/config
```

## Networks

| | Chain ID | RPC | Explorer |
|---|---|---|---|
| Production | 16661 | https://evmrpc.0g.ai | https://chainscan.0g.ai |
| Rehearsal only | 16602 | https://evmrpc-testnet.0g.ai | https://chainscan-galileo.0g.ai |

## Run locally

```bash
cp .env.example .env
# fill keys — never commit .env

npm install
npm run test:contracts   # needs Foundry
npm run api
npm run web
```

Frontend public env is `VITE_PRIVY_APP_ID` and `VITE_API_URL`. Never put `sk-`, `mk-`, or private keys in `VITE_*`.

## License

MIT
