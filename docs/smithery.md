# Smithery integration

- The Smithery entrypoint is `src/smithery.ts`.
- It exports `configSchema` and a default sync function returning the MCP server instance.
- On startup, if `apifyToken`/`APIFY_TOKEN` is provided, tools load asynchronously and the first `listTools` is gated via a one-time barrier (`blockListToolsUntil`).
- If no token is provided, tools are loaded with placeholder token `PLACEHOLDER_TOKEN` to allow the server to start without real secrets.

Run with Smithery:

```bash
npx @smithery/cli build
# optional, recommended for actors
export APIFY_TOKEN="your-apify-token"
npx @smithery/cli dev
```

Notes:
- The barrier is used only by Smithery; stdio/SSE/HTTP flows are unaffected.
- We use a placeholder token (`your-apify-token`) in non-interactive environments (Smithery scans) to allow tool-loading paths to run without real secrets. It does not grant access; when detected, the client runs unauthenticated to let the server start and list tools where possible.

## Deployment

- Publishing to Smithery uses a personal account due to group account functionality issues.
- Publication happens through a repository fork at https://github.com/apify-projects/apify-mcp-server since Smithery requires repository write access, which cannot be granted to the main Apify account (https://github.com/apify/apify-mcp-server).
- The fork requires manual synchronization to stay current, as automatic syncing is not configured.
- As of August 22nd, Smithery supports external server publishing with the requirement of an `/mcp` endpoint.
