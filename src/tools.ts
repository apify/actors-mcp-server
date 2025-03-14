import { Ajv } from 'ajv';
import type { ActorStoreList } from 'apify-client';
import { ApifyClient } from 'apify-client';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { actorNameToToolName } from './actors.js';
import { ACTOR_README_MAX_LENGTH, InternalTools } from './const.js';
import type { ActorStorePruned, PricingInfo, Tool } from './types.js';

export const DiscoverActorsArgsSchema = z.object({
    limit: z.number()
        .int()
        .min(1)
        .max(100)
        .default(10)
        .describe('The maximum number of Actors to return. Default value is 10.'),
    offset: z.number()
        .int()
        .min(0)
        .default(0)
        .describe('The number of elements that should be skipped at the start. Default value is 0.'),
    search: z.string()
        .default('')
        .describe('String of key words to search by. '
            + 'Searches the title, name, description, username, and readme of an Actor.'
            + 'Only key word search is supported, no advanced search.'
            + 'Always prefer simple keywords over complex queries.'),
    category: z.string()
        .default('')
        .describe('Filters the results by the specified category.'),
});

export const RemoveActorToolArgsSchema = z.object({
    toolName: z.string()
        .describe('Tool name to remove from available tools.')
        .transform((val) => actorNameToToolName(val)),
});

export const AddActorToToolsArgsSchema = z.object({
    actorName: z.string()
        .describe('Add an Actor to available tools by Actor ID or Actor full name.'
            + 'Actor name is always composed from `username/name`'),
});

export const GetActorDefinition = z.object({
    actorName: z.string()
        .describe('Retrieve input, readme, and other details for Actor ID or Actor full name. '
            + 'Actor name is always composed from `username/name`'),
    limit: z.number()
        .int()
        .default(ACTOR_README_MAX_LENGTH)
        .describe(`Truncate the README to this limit. Default value is ${ACTOR_README_MAX_LENGTH}.`),
});

export function getActorAutoLoadingTools(): Tool[] {
    const ajv = new Ajv({ coerceTypes: 'array', strict: false });
    return [
        {
            name: InternalTools.ADD_ACTOR_TO_TOOLS,
            actorFullName: InternalTools.ADD_ACTOR_TO_TOOLS,
            description: 'Add an Actor to available tools by Actor ID or Actor name. '
                + 'Do not execute the Actor, only add it and list it in available tools. '
                + 'Never run the tool without user consent! '
                + 'For example, add a tool with username/name when user wants to scrape data from a website.',
            inputSchema: zodToJsonSchema(AddActorToToolsArgsSchema),
            ajvValidate: ajv.compile(zodToJsonSchema(AddActorToToolsArgsSchema)),
        },
        {
            name: InternalTools.REMOVE_ACTOR_FROM_TOOLS,
            actorFullName: InternalTools.REMOVE_ACTOR_FROM_TOOLS,
            description: 'Remove tool by name from available tools. '
                + 'For example, when user says, I do not need a tool username/name anymore',
            inputSchema: zodToJsonSchema(RemoveActorToolArgsSchema),
            ajvValidate: ajv.compile(zodToJsonSchema(RemoveActorToolArgsSchema)),
        },
    ];
}

export function getActorDiscoveryTools(): Tool[] {
    const ajv = new Ajv({ coerceTypes: 'array', strict: false });
    return [
        {
            name: InternalTools.DISCOVER_ACTORS,
            actorFullName: InternalTools.DISCOVER_ACTORS,
            description: `Discover available Actors using full text search using keywords.`
                + `Users try to discover Actors using free form query in this case search query needs to be converted to full text search. `
                + `Prefer Actors from Apify as they are generally more reliable and have better support. `
                + `Returns a list of Actors with name, description, run statistics, pricing, starts, and URL. `
                + `You perhaps need to use this tool several times to find the right Actor. `
                + `Limit number of results returned but ensure that relevant results are returned. `,
            inputSchema: zodToJsonSchema(DiscoverActorsArgsSchema),
            ajvValidate: ajv.compile(zodToJsonSchema(DiscoverActorsArgsSchema)),
        },
        {
            name: InternalTools.GET_ACTOR_DETAILS,
            actorFullName: InternalTools.GET_ACTOR_DETAILS,
            description: 'Get documentation, readme, input schema and other details about an Actor. '
                + 'For example, when user says, I need to know more about web crawler Actor.'
                + 'Get details for an Actor with with Actor ID or Actor full name, i.e. username/name.'
                + `Limit the length of the README if needed.`,
            inputSchema: zodToJsonSchema(GetActorDefinition),
            ajvValidate: ajv.compile(zodToJsonSchema(GetActorDefinition)),
        },
    ];
}

function pruneActorStoreInfo(response: ActorStoreList): ActorStorePruned {
    const stats = response.stats || {};
    const pricingInfo = (response.currentPricingInfo || {}) as PricingInfo;
    return {
        id: response.id,
        name: response.name?.toString() || '',
        username: response.username?.toString() || '',
        actorFullName: `${response.username}/${response.name}`,
        title: response.title?.toString() || '',
        description: response.description?.toString() || '',
        stats: {
            totalRuns: stats.totalRuns,
            totalUsers30Days: stats.totalUsers30Days,
            publicActorRunStats30Days: 'publicActorRunStats30Days' in stats
                ? stats.publicActorRunStats30Days : {},
        },
        currentPricingInfo: {
            pricingModel: pricingInfo.pricingModel?.toString() || '',
            pricePerUnitUsd: pricingInfo?.pricePerUnitUsd ?? 0,
            trialMinutes: pricingInfo?.trialMinutes ?? 0,
        },
        url: response.url?.toString() || '',
        totalStars: 'totalStars' in response ? (response.totalStars as number) : null,
    };
}

export async function searchActorsByKeywords(
    search: string,
    limit: number | undefined = undefined,
    offset: number | undefined = undefined,
): Promise<ActorStorePruned[] | null> {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const results = await client.store().list({ search, limit, offset });
    return results.items.map((x) => pruneActorStoreInfo(x));
}
