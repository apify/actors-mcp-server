import { Ajv } from 'ajv';
import { ApifyClient } from 'apify-client';

import { ACTOR_ADDITIONAL_INSTRUCTIONS, defaults, MAX_DESCRIPTION_LENGTH } from './const.js';
import { log } from './logger.js';
import type { ActorDefinitionPruned, ActorDefinitionWithDesc, SchemaProperties, Tool } from './types.js';

export function actorNameToToolName(actorName: string): string {
    return actorName.replace('/', '--');
}

export function toolNameToActorName(toolName: string): string {
    return toolName.replace('--', '/');
}

/**
 * Get actor input schema by actor name.
 * First, fetch the actor details to get the default build tag and buildId.
 * Then, fetch the build details and return actorName, description, and input schema.
 * @param {string} actorFullName - The full name of the actor.
 * @returns {Promise<ActorDefinitionWithDesc | null>} - The actor definition with description or null if not found.
 */
export async function getActorDefinition(actorFullName: string): Promise<ActorDefinitionPruned | null> {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const actorClient = client.actor(actorFullName);

    try {
        // Fetch actor details
        const actor = await actorClient.get();
        if (!actor) {
            log.error(`Failed to fetch input schema for actor: ${actorFullName}. Actor not found.`);
            return null;
        }

        // fnesveda: The default build is not necessarily tagged, you can specify any build number as default build.
        // There will be a new API endpoint to fetch a default build.
        // For now, we'll use the tagged build, it will work for 90% of Actors. Later, we can update this.
        const tag = actor.defaultRunOptions?.build || '';
        const buildId = actor.taggedBuilds?.[tag]?.buildId || '';

        if (!buildId) {
            log.error(`Failed to fetch input schema for actor: ${actorFullName}. Build ID not found.`);
            return null;
        }
        // Fetch build details and return the input schema
        const buildDetails = await client.build(buildId).get();
        if (buildDetails?.actorDefinition) {
            const actorDefinitions = buildDetails?.actorDefinition as ActorDefinitionWithDesc;
            actorDefinitions.description = actor.description || '';
            actorDefinitions.actorFullName = actorFullName;
            actorDefinitions.defaultRunOptions = actor.defaultRunOptions;
            return pruneActorDefinition(actorDefinitions);
        }
        return null;
    } catch (error) {
        log.error(`Failed to fetch input schema for actor: ${actorFullName} with error ${error}.`);
        throw new Error(`Failed to fetch input schema for actor: ${actorFullName} with error ${error}.`);
    }
}

function pruneActorDefinition(response: ActorDefinitionWithDesc): ActorDefinitionPruned {
    return {
        actorFullName: response.actorFullName || '',
        buildTag: response?.buildTag || '',
        readme: response?.readme || '',
        input: response?.input || null,
        description: response.description,
        defaultRunOptions: response.defaultRunOptions,
    };
}

/**
 * Shortens the description and enum values of schema properties.
 * @param properties
 */
export function shortenProperties(properties: { [key: string]: SchemaProperties}): { [key: string]: SchemaProperties } {
    for (const property of Object.values(properties)) {
        if (property.description.length > MAX_DESCRIPTION_LENGTH) {
            property.description = `${property.description.slice(0, MAX_DESCRIPTION_LENGTH)}...`;
        }
    }
    return properties;
}

/**
 * Filters schema properties to include only the necessary fields.
 * @param properties
 */
export function filterSchemaProperties(properties: { [key: string]: SchemaProperties }): { [key: string]: SchemaProperties } {
    const filteredProperties: { [key: string]: SchemaProperties } = {};
    for (const [key, property] of Object.entries(properties)) {
        const { title, description, enum: enumValues, type, default: defaultValue, prefill } = property;
        filteredProperties[key] = { title, description, enum: enumValues, type, default: defaultValue, prefill };
    }
    return filteredProperties;
}

/**
 * Fetches actor input schemas by actor full names and creates MCP tools.
 *
 * This function retrieves the input schemas for the specified actors and compiles them into MCP tools.
 * It uses the AJV library to validate the input schemas.
 *
 * Tool name can't contain /, so it is replaced with _
 *
 * @param {string[]} actors - An array of actor full names.
 * @returns {Promise<Tool[]>} - A promise that resolves to an array of MCP tools.
 */
export async function getActorsAsTools(actors: string[]): Promise<Tool[]> {
    const ajv = new Ajv({ coerceTypes: 'array', strict: false });
    const results = await Promise.all(actors.map(getActorDefinition));
    const tools = [];
    for (const result of results) {
        if (result) {
            if (result.input && 'properties' in result.input && result.input) {
                const properties = filterSchemaProperties(result.input.properties as { [key: string]: SchemaProperties });
                result.input.properties = shortenProperties(properties);
            }
            try {
                const memoryMbytes = result.defaultRunOptions?.memoryMbytes || defaults.maxMemoryMbytes;
                tools.push({
                    name: actorNameToToolName(result.actorFullName),
                    actorFullName: result.actorFullName,
                    description: `${result.description} Instructions: ${ACTOR_ADDITIONAL_INSTRUCTIONS}`,
                    inputSchema: result.input || {},
                    ajvValidate: ajv.compile(result.input || {}),
                    memoryMbytes: memoryMbytes > defaults.maxMemoryMbytes ? defaults.maxMemoryMbytes : memoryMbytes,
                });
            } catch (validationError) {
                log.error(`Failed to compile AJV schema for actor: ${result.actorFullName}. Error: ${validationError}`);
            }
        }
    }
    return tools;
}
