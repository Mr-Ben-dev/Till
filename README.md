# Till

**Give an agent a Till. It can pay and finish work. It cannot empty you.**

An agent service account with a budget you control. It buys the intelligence needed to complete a task. The agent never receives your wallet.

- App: https://till-0g.vercel.app
- API: https://till-api.onrender.com
- Repo: https://github.com/Mr-Ben-dev/Till

No shared operator wallet. No mock TEE. No OpenAI/Groq fallback.

## Before you pay

Paste a token, contract, or protocol. The agent selects real x402 checks (token safety, market/oracle, contract risk), 0G Compute verifies privately, then you get **BUY / HOLD / AVOID** with spend and on-chain proof.

## Owner vs autonomous

| Step | Who signs |
|---|---|
| Connect, mint, fund, policy, authorize, revoke, withdraw, pause | Owner wallet (MetaMask) |
| x402 service purchases | Operator Herald rail (USDC.e). Not your session key. |
| Storage proof (`anchorPacket`) | **Session key** if autonomous mode is authorized and funded with gas; otherwise owner |
| Jobs TEE-signer bind | Owner only (`setTillTeeSigner`) |

Autonomous mode is a device-local session key on this Till. It cannot withdraw or change policy. If gas is zero, the app stays in owner mode for on-chain proof.

## Developers

- App: https://till-0g.vercel.app/developers
- MCP HTTP: `https://till-api.onrender.com/mcp`
- SDK: `npm install @till-0g/sdk`
- Local MCP: `npx -y @till-0g/mcp` with `TILL_ACCESS_TOKEN`

MCP never accepts a private key. Default scopes are read/quote. `till.mission.execute` requires an on-chain autonomous session. Storage proofs stay on the device session — MCP does not upload session keys.

Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "till": { "url": "https://till-api.onrender.com/mcp" }
  }
}
```

Then authorize in the app, or add `headers.Authorization: Bearer <token>`.

Claude Code:

```bash
claude mcp add --transport http till https://till-api.onrender.com/mcp
```

## Funding

- **Till balance** — native 0G you can withdraw.
- **USDC.e** — x402 settlement asset. Swap on [0G Hub](https://hub.0g.ai/swap?network=mainnet).
- **0G Compute** — billed separately via Payment Layer.

## Production contracts (Aristotle 16661)

| Contract | Address |
|---|---|
| TillAgentNFT | [`0x730e7c02D1C238D98aD38AFED98a7CBA980901bF`](https://chainscan.0g.ai/address/0x730e7c02D1C238D98aD38AFED98a7CBA980901bF) |
| TillPolicy | [`0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c`](https://chainscan.0g.ai/address/0xBf05e322e3C3047089e9Dd9E10Bd8ee320149f7c) |
| TillVerifier | [`0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1`](https://chainscan.0g.ai/address/0x4C8bed5Ec7e1F0c0CC7a7Ef141370dd9f4e1A7f1) |
| TillVault | [`0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB`](https://chainscan.0g.ai/address/0x2eD09745E5Ca4BdeaBc93aB3aab65781B03Ed4cB) |
| TillJobEscrow | [`0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9`](https://chainscan.0g.ai/address/0x1BB730Ff8A4Ff93dE9eDD54B178C0Bc9ddE99de9) |

Verify a payment: open `/verify`. No wallet required.

## MetaMask “malicious site” on vercel.app

Privy **Allowed origins** does not control that warning. MetaMask/Blockaid often flags `*.vercel.app`. Confirm the URL is `https://till-0g.vercel.app`, then Connect anyway if it matches. Switch the Privy app from **Development** to **Production**. Report false positives: [eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect/issues) and [Blockaid](https://report.blockaid.io/).

## Run locally

```bash
cp .env.example .env
npm install
npm run api
npm run web
```

Never put `sk-`, `mk-`, or private keys in `VITE_*`.

## License

MIT
