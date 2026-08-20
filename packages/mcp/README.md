# @till-0g/mcp

Local stdio MCP server for Till. Set `TILL_ACCESS_TOKEN` from https://till-0g.vercel.app/developers.

Cursor:

```json
{
  "mcpServers": {
    "till": {
      "command": "npx",
      "args": ["-y", "@till-0g/mcp"],
      "env": { "TILL_ACCESS_TOKEN": "YOUR_TOKEN", "TILL_API_URL": "https://till-api.onrender.com" }
    }
  }
}
```

Claude Code:

```
claude mcp add till -- npx -y @till-0g/mcp
```
