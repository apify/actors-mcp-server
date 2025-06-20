import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Notification, Request } from '@modelcontextprotocol/sdk/types.js';
import type { ValidateFunction } from 'ajv';
import type { ActorDefaultRunOptions, ActorDefinition } from 'apify-client';

import type { ActorsMcpServer } from './mcp/server.js';

export interface ISchemaProperties {
    type: string;

    title: string;
    description: string;

    enum?: string[]; // Array of string options for the enum
    enumTitles?: string[]; // Array of string titles for the enum
    default?: unknown;
    prefill?: unknown;

    items?: ISchemaProperties;
    editor?: string;
    examples?: unknown[];

    properties?: Record<string, ISchemaProperties>;
    required?: string[];
}

export interface IActorInputSchema {
    $id?: string;
    title?: string;
    description?: string;

    type: string;

    properties: Record<string, ISchemaProperties>;

    required?: string[];
    schemaVersion?: number;
}

export type ActorDefinitionWithDesc = Omit<ActorDefinition, 'input'> & {
    id: string;
    actorFullName: string;
    description: string;
    defaultRunOptions: ActorDefaultRunOptions;
    input?: IActorInputSchema;
}

export type ActorDefinitionPruned = Pick<ActorDefinitionWithDesc,
    'id' | 'actorFullName' | 'buildTag' | 'readme' | 'input' | 'description' | 'defaultRunOptions'>

/**
 * Base interface for all tools in the MCP server.
 * Contains common properties shared by all tool types.
 */
export interface ToolBase {
    /** Unique name/identifier for the tool */
    name: string;
    /** Description of what the tool does */
    description: string;
    /** JSON schema defining the tool's input parameters */
    inputSchema: object;
    /** AJV validation function for the input schema */
    ajvValidate: ValidateFunction;
}

/**
 * Interface for Actor-based tools - tools that wrap Apify Actors.
 * Extends ToolBase with Actor-specific properties.
 */
export interface ActorTool extends ToolBase {
    /** Full name of the Apify Actor (username/name) */
    actorFullName: string;
    /** Optional memory limit in MB for the Actor execution */
    memoryMbytes?: number;
}

/**
 * Arguments passed to internal tool calls.
 * Contains both the tool arguments and server references.
 */
export type InternalToolArgs = {
    /** Arguments passed to the tool */
    args: Record<string, unknown>;
    /** Extra data given to request handlers.
     *
     * Can be used to send notifications from the server to the client.
     *
     * For more details see: https://github.com/modelcontextprotocol/typescript-sdk/blob/f822c1255edcf98c4e73b9bf17a9dd1b03f86716/src/shared/protocol.ts#L102
     */
    extra: RequestHandlerExtra<Request, Notification>;
    /** Reference to the Apify MCP server instance */
    apifyMcpServer: ActorsMcpServer;
    /** Reference to the MCP server instance */
    mcpServer: Server;
    /** Apify API token */
    apifyToken: string;
}

/**
 * Interface for internal tools - tools implemented directly in the MCP server.
 * Extends ToolBase with a call function implementation.
 */
export interface HelperTool extends ToolBase {
    /**
     * Executes the tool with the given arguments
     * @param toolArgs - Arguments and server references
     * @returns Promise resolving to the tool's output
     */
    call: (toolArgs: InternalToolArgs) => Promise<object>;
}

/**
* Actorized MCP server tool where this MCP server acts as a proxy.
* Extends ToolBase with a tool-associated MCP server.
*/
export interface ActorMcpTool extends ToolBase {
    // Origin MCP server tool name is needed for the tool call
    originToolName: string;
    // ID of the Actorized MCP server - for example, apify/actors-mcp-server
    actorId: string;
    /**
     * ID of the Actorized MCP server the tool is associated with.
     * serverId is generated unique ID based on the serverUrl.
     */
    serverId: string;
    // Connection URL of the Actorized MCP server
    serverUrl: string;
}

/**
 * Type discriminator for tools - indicates whether a tool is internal or Actor-based.
 */
export type ToolType = 'internal' | 'actor' | 'actor-mcp';

/**
 * Wrapper interface that combines a tool with its type discriminator.
 * Used to store and manage tools of different types uniformly.
 */
export interface ToolEntry {
    /** Type of the tool (internal or actor) */
    type: ToolType;
    /** The tool instance */
    tool: ActorTool | HelperTool | ActorMcpTool;
}

//  ActorStoreList for actor-search tool
export interface ActorStats {
    totalRuns: number;
    totalUsers30Days: number;
    publicActorRunStats30Days: unknown;
}

export interface PricingInfo {
    pricingModel?: string;
    pricePerUnitUsd?: number;
    trialMinutes?: number
}

export interface ActorStorePruned {
    id: string;
    name: string;
    username: string;
    actorFullName?: string;
    title?: string;
    description?: string;
    stats: ActorStats;
    currentPricingInfo: PricingInfo;
    url: string;
    totalStars?: number | null;
}

/**
 * Interface for internal tools - tools implemented directly in the MCP server.
 * Extends ToolBase with a call function implementation.
 */
export interface InternalTool extends ToolBase {
    /**
     * Executes the tool with the given arguments
     * @param toolArgs - Arguments and server references
     * @returns Promise resolving to the tool's output
     */
    call: (toolArgs: InternalToolArgs) => Promise<object>;
}

export type Input = {
    actors: string[] | string;
    /**
    * @deprecated Use `enableAddingActors` instead.
    */
    enableActorAutoLoading?: boolean | string;
    enableAddingActors?: boolean | string;
    maxActorMemoryBytes?: number;
    debugActor?: string;
    debugActorInput?: unknown;
};

export interface ToolCacheEntry {
    expiresAt: number;
    tool: ToolEntry;
}
