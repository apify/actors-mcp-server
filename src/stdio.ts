#!/usr/bin/env node
/**
 * This script initializes and starts the Apify MCP server using the Stdio transport.
 *
 * Usage:
 *   node <script_name> --actors=<actor1,actor2,...>
 *
 * Command-line arguments:
 *   --actors - A comma-separated list of Actor full names to add to the server.
 *   --help - Display help information
 *
 * Example:
 *   node stdio.js --actors=apify/google-search-scraper,apify/instagram-scraper
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import yargs from 'yargs';
// Had to ignore the eslint import extension error for the yargs package.
// Using .js or /index.js didn't resolve it due to the @types package issues.
// eslint-disable-next-line import/extensions
import { hideBin } from 'yargs/helpers';

import log from '@apify/log';

import { defaults } from './const.js';
import { ActorsMcpServer } from './mcp/server.js';
import { getActorsAsTools } from './tools/index.js';

// Keeping this interface here and not types.ts since
// it is only relevant to the CLI/STDIO transport in this file
/**
 * Interface for command line arguments
 */
interface CliArgs {
    actors?: string;
    enableAddingActors: boolean;
    /** @deprecated */
    enableActorAutoLoading: boolean;
    beta: boolean;
}

// Configure logging, set to ERROR
log.setLevel(log.LEVELS.ERROR);

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('actors', {
        type: 'string',
        describe: 'Comma-separated list of Actor full names to add to the server',
        example: 'apify/google-search-scraper,apify/instagram-scraper',
    })
    .option('enable-adding-actors', {
        type: 'boolean',
        default: true,
        describe: 'Enable dynamically adding Actors as tools based on user requests',
    })
    .option('enableActorAutoLoading', {
        type: 'boolean',
        default: true,
        hidden: true,
        describe: 'Deprecated: use enable-adding-actors instead',
    })
    .option('beta', {
        type: 'boolean',
        default: false,
        describe: 'Enable beta features',
    })
    .help('help')
    .alias('h', 'help')
    .version(false)
    .epilogue(
        'To connect, set your MCP client server command to `npx @apify/actors-mcp-server`'
        + ' and set the environment variable `APIFY_TOKEN` to your Apify API token.\n',
    )
    .epilogue('For more information, visit https://github.com/apify/actors-mcp-server')
    .parseSync() as CliArgs;

const enableAddingActors = argv.enableAddingActors && argv.enableActorAutoLoading;
const actors = argv.actors as string || '';
const actorList = actors ? actors.split(',').map((a: string) => a.trim()) : [];
const enableBeta = argv.beta;

// Validate environment
if (!process.env.APIFY_TOKEN) {
    log.error('APIFY_TOKEN is required but not set in the environment variables.');
    process.exit(1);
}

async function main() {
    const mcpServer = new ActorsMcpServer({ enableAddingActors, enableDefaultActors: false, enableBeta });
    const tools = await getActorsAsTools(actorList.length ? actorList : defaults.actors, process.env.APIFY_TOKEN as string);
    mcpServer.upsertTools(tools);

    // Start server
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
}

main().catch((error) => {
    log.error(`Server error: ${error}`);
    process.exit(1);
});
