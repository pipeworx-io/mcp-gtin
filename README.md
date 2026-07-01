# mcp-gtin

Barcode / GTIN validation MCP (EAN-13, UPC-A, EAN-8, GTIN-14).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1133+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `gtin_check_digit` | Compute the mod-10 check digit for GTIN/EAN/UPC data digits (all digits EXCEPT the check digit). Use to generate or repair a barcode. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "gtin": {
      "url": "https://gateway.pipeworx.io/gtin/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1133+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Gtin data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
