import { Ajv } from 'ajv';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

import { HelperTools } from '../const.js';
import type { InternalTool, ToolEntry } from '../types';
import { getActorsAsTools } from './actor.js';
import { actorNameToToolName } from './utils.js';

const ajv = new Ajv({ coerceTypes: 'array', strict: false });

const APIFY_MCP_HELP_TOOL_TEXT = `Apify MCP server help:

Note: "MCP" stands for "Model Context Protocol". The user can use the "RAG Web Browser" tool to get the content of the links mentioned in this help and present it to the user.

This MCP server can be used in the following ways:
- Locally over "STDIO".
- Remotely over "SSE" or streamable "HTTP" transport with the "Actors MCP Server Apify Actor".
- Remotely over "SSE" or streamable "HTTP" transport with "https://mcp.apify.com".

# Usage
## Locally over "STDIO"
1. The user should install the "@apify/actors-mcp-server" NPM package.
2. The user should configure the MCP client to use the MCP server. Refer to "https://github.com/apify/actors-mcp-server" or the MCP client documentation for more details (the user can specify which MCP client is being used).
The user needs to set the following environment variables:
- "APIFY_TOKEN": Apify token to authenticate with the MCP server.
If the user wants to load an Actor outside the default ones, the user needs to pass it as a CLI argument:
- "--actors <actor1,actor2,...>" // comma-separated list of Actor names, for example, "apify/rag-web-browser,apify/instagram-scraper".
If the user wants to enable the dynamic addition of Actors to the MCP server, the user needs to pass the following CLI argument:
- "--enable-adding-actors".

## Remotely over "SSE" or streamable "HTTP" transport with "Actors MCP Server Apify Actor"
1. The user should configure the MCP client to use the "Actors MCP Server Apify Actor" with:
   - "SSE" transport URL: "https://actors-mcp-server.apify.actor/sse".
   - Streamable "HTTP" transport URL: "https://actors-mcp-server.apify.actor/mcp".
2. The user needs to pass an "APIFY_TOKEN" as a URL query parameter "?token=<APIFY_TOKEN>" or set the following headers: "Authorization: Bearer <APIFY_TOKEN>".
If the user wants to load an Actor outside the default ones, the user needs to pass it as a URL query parameter:
- "?actors=<actor1,actor2,...>" // comma-separated list of Actor names, for example, "apify/rag-web-browser,apify/instagram-scraper".
If the user wants to enable the addition of Actors to the MCP server dynamically, the user needs to pass the following URL query parameter:
- "?enable-adding-actors=true".

## Remotely over "SSE" or streamable "HTTP" transport with "https://mcp.apify.com"
1. The user should configure the MCP client to use "https://mcp.apify.com" with:
   - "SSE" transport URL: "https://mcp.apify.com/sse".
   - Streamable "HTTP" transport URL: "https://mcp.apify.com/".
2. The user needs to pass an "APIFY_TOKEN" as a URL query parameter "?token=<APIFY_TOKEN>" or set the following headers: "Authorization: Bearer <APIFY_TOKEN>".
If the user wants to load an Actor outside the default ones, the user needs to pass it as a URL query parameter:
- "?actors=<actor1,actor2,...>" // comma-separated list of Actor names, for example, "apify/rag-web-browser,apify/instagram-scraper".
If the user wants to enable the addition of Actors to the MCP server dynamically, the user needs to pass the following URL query parameter:
- "?enable-adding-actors=true".

# Features
## Dynamic adding of Actors
THIS FEATURE MAY NOT BE SUPPORTED BY ALL MCP CLIENTS. THE USER MUST ENSURE THAT THE CLIENT SUPPORTS IT!
To enable this feature, see the usage section. Once dynamic adding is enabled, tools will be added that allow the user to add or remove Actors from the MCP server.
Tools related:
- "add-actor".
- "remove-actor".
If the user is using these tools and it seems like the tools have been added but cannot be called, the issue may be that the client does not support dynamic adding of Actors.
In that case, the user should check the MCP client documentation to see if the client supports this feature.
`;

export const addToolArgsSchema = z.object({
    actorName: z.string()
        .min(1)
        .describe('Add a tool, Actor or MCP-Server to available tools by Actor ID or tool full name.'
            + 'Tool name is always composed from `username/name`'),
});
export const addTool: ToolEntry = {
    type: 'internal',
    tool: {
        name: HelperTools.ACTOR_ADD,
        description: 'Add a tool, Actor or MCP-Server to available tools by Actor ID or Actor name. '
            + 'A tool is an Actor or MCP-Server that can be called by the user'
            + 'Do not execute the tool, only add it and list it in available tools. '
            + 'For example, add a tool with username/name when user wants to scrape data from a website.',
        inputSchema: zodToJsonSchema(addToolArgsSchema),
        ajvValidate: ajv.compile(zodToJsonSchema(addToolArgsSchema)),
        // TODO: I don't like that we are passing apifyMcpServer and mcpServer to the tool
        call: async (toolArgs) => {
            const { apifyMcpServer, apifyToken, args, extra: { sendNotification } } = toolArgs;
            const parsed = addToolArgsSchema.parse(args);
            if (apifyMcpServer.listAllToolNames().includes(parsed.actorName)) {
                return {
                    content: [{
                        type: 'text',
                        text: `Actor ${parsed.actorName} is already available. No new tools were added.`,
                    }],
                };
            }
            const tools = await getActorsAsTools([parsed.actorName], apifyToken);
            const toolsAdded = apifyMcpServer.upsertTools(tools, true);
            await sendNotification({ method: 'notifications/tools/list_changed' });

            return {
                content: [{
                    type: 'text',
                    text: `Actor ${parsed.actorName} has been added. Newly available tools: ${
                        toolsAdded.map(
                            (t) => `${t.tool.name}`,
                        ).join(', ')
                    }.`,
                }],
            };
        },
    } as InternalTool,
};
export const removeToolArgsSchema = z.object({
    toolName: z.string()
        .min(1)
        .describe('Tool name to remove from available tools.')
        .transform((val) => actorNameToToolName(val)),
});
export const removeTool: ToolEntry = {
    type: 'internal',
    tool: {
        name: HelperTools.ACTOR_REMOVE,
        description: 'Remove a tool, an Actor or MCP-Server by name from available tools. '
            + 'For example, when user says, I do not need a tool username/name anymore',
        inputSchema: zodToJsonSchema(removeToolArgsSchema),
        ajvValidate: ajv.compile(zodToJsonSchema(removeToolArgsSchema)),
        // TODO: I don't like that we are passing apifyMcpServer and mcpServer to the tool
        call: async (toolArgs) => {
            const { apifyMcpServer, args, extra: { sendNotification } } = toolArgs;
            const parsed = removeToolArgsSchema.parse(args);
            // Check if tool exists before attempting removal
            if (!apifyMcpServer.tools.has(parsed.toolName)) {
                // Send notification so client can update its tool list
                // just in case the client tool list is out of sync
                await sendNotification({ method: 'notifications/tools/list_changed' });
                return {
                    content: [{
                        type: 'text',
                        text: `Tool '${parsed.toolName}' not found. No tools were removed.`,
                    }],
                };
            }
            const removedTools = apifyMcpServer.removeToolsByName([parsed.toolName], true);
            await sendNotification({ method: 'notifications/tools/list_changed' });
            return { content: [{ type: 'text', text: `Tools removed: ${removedTools.join(', ')}` }] };
        },
    } as InternalTool,
};

// Tool takes no arguments
export const helpToolArgsSchema = z.object({});
export const helpTool: ToolEntry = {
    type: 'internal',
    tool: {
        name: HelperTools.APIFY_MCP_HELP_TOOL,
        description: 'Helper tool to get information on how to use and troubleshoot the Apify MCP server. '
            + 'This tool always returns the same help message with information about the server and how to use it. '
            + 'Call this tool in case of any problems or uncertainties with the server. ',
        inputSchema: zodToJsonSchema(helpToolArgsSchema),
        ajvValidate: ajv.compile(zodToJsonSchema(helpToolArgsSchema)),
        call: async () => {
            return { content: [{ type: 'text', text: APIFY_MCP_HELP_TOOL_TEXT }] };
        },
    } as InternalTool,
};
