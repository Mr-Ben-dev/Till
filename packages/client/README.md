# @till-0g/sdk

Public Till client. Talks to `https://till-api.onrender.com`. Create a scoped MCP token at https://till-0g.vercel.app/developers — never pass a wallet private key.

```ts
import { createClient } from '@till-0g/sdk'
const till = createClient({ apiUrl: 'https://till-api.onrender.com', token: process.env.TILL_ACCESS_TOKEN! })
const quote = await till.quoteMission('Should I deposit into this protocol? 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
```
