# till-0g-mcp

Local stdio MCP server for Till. Framing is newline-delimited JSON-RPC (current MCP spec). Set `TILL_ACCESS_TOKEN` from https://till-0g.vercel.app/developers. Never pass a private key.

Cursor (`.cursor/mcp.json` or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "till": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "till-0g-mcp"],
      "env": {
        "TILL_ACCESS_TOKEN": "${env:TILL_ACCESS_TOKEN}",
        "TILL_API_URL": "https://till-api.onrender.com"
      }
    }
  }
}
```

Remote HTTP (Cursor also supports this without the stdio package):

```json
{
  "mcpServers": {
    "till": {
      "url": "https://till-api.onrender.com/mcp"
    }
  }
}
```

Claude Code:

```
claude mcp add --transport http till https://till-api.onrender.com/mcp
claude mcp add --transport stdio till --env TILL_ACCESS_TOKEN=YOUR_TOKEN -- npx -y till-0g-mcp
```
