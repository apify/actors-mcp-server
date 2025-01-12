import { Ajv } from 'ajv';
import { ApifyClient } from 'apify-client';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { InternalTools } from './const.js';
import { log } from './logger.js';
import {Tool} from "./types";

export const SearchActorsArgsSchema = z.object({
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
            + 'Only key word search is supported, no advanced search.',
        ),
    category: z.string()
        .default('')
        .describe('Filters the results by the specified category.'),
});

export const RemoveActorToolArgsSchema = z.object({
    name: z.string().describe('The name of the Actor tool to remove.'),
});

export const AddActorToToolsArgsSchema = z.object({
    name: z.string().describe('The name of the Actor to add as tool.'),
});

export function getInternalTools(): Tool[] {
    const ajv = new Ajv({ coerceTypes: 'array', strict: false });
    return [
        // {
        //     name: InternalTools.SEARCH_ACTORS,
        //     description: 'Search for actors by keywords. Returns a list of actors with name, description, and readme.',
        //     inputSchema: zodToJsonSchema(SearchActorsArgsSchema),
        //     ajvValidate: ajv.compile(zodToJsonSchema(SearchActorsArgsSchema)),
        // },
        // {
        //     name: InternalTools.ADD_ACTOR_TO_TOOLS,
        //     description: 'Add an actor tool by name to available tools. '
        //         + 'For example, when user says, I need to use apify/rag-web-browser',
        //     inputSchema: zodToJsonSchema(AddActorToToolsArgsSchema),
        //     // ajvValidate: ajv.compile(zodToJsonSchema(AddActorToToolsArgsSchema)),
        // },
        // {
        //     name: InternalTools.REMOVE_ACTOR_FROM_TOOLS,
        //     description: 'Remove an actor tool by name from available toos. '
        //         + 'For example, when user says, I do not need tool apify_rag-web-browser',
        //     inputSchema: zodToJsonSchema(RemoveActorToolArgsSchema),
        //     // ajvValidate: ajv.compile(zodToJsonSchema(RemoveActorToolArgsSchema)),
        // },
    ];
}

export async function searchActorsByKeywords(
    search: string,
    limit: number | undefined = undefined,
    offset: number | undefined = undefined,
) {
    if (!process.env.APIFY_API_TOKEN) {
        log.error('APIFY_API_TOKEN is required but not set. Please set it as an environment variable');
        return null;
    }
    const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
    const results = await client.store().list({ search, limit, offset });
    return results.items;
}
