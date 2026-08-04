# mcp-gtin

Barcode / GTIN validation MCP (EAN-13, UPC-A, EAN-8, GTIN-14).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `validate_gtin` | Validate a barcode number — EAN-13, UPC-A (12), EAN-8, or GTIN-14 (keyless, offline). Checks the mod-10 check digit, reports the format, normalizes to GTIN-14, and returns the GS1 prefix + issuing country/region. Spaces/dashes ignored. Validates the number, not the product. |
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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

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

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
