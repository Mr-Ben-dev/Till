# till-0g-sdk

Public Till client. Talks to `https://till-api.onrender.com`. Create a scoped token at https://till-0g.vercel.app/developers — never pass a wallet private key.

```ts
import { createClient } from 'till-0g-sdk'

const till = createClient({
  apiUrl: 'https://till-api.onrender.com',
  token: process.env.TILL_ACCESS_TOKEN!,
})

await till.listTills()
await till.getTill('2')
await till.getPolicy()
await till.quoteMission('Investigate this contract. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
await till.getProof('0x494a23418750b795ef8070240f0d8bb416b29f7f2f8ffd7613265101f5cbeb50')
```

`createClient` rejects a missing token and any value that looks like a private key.
