export const SERVER_NAME = 'apify-mcp-server';
export const SERVER_VERSION = '0.1.0';

export const ACTOR_OUTPUT_ITEM_MAX_CHARS = 1_000;

export const defaults = {
    actors: [
        'apidojo/tweet-scraper',
        'apify/facebook-posts-scraper',
        'apify/google-search-scraper',
        'apify/instagram-scraper',
        'apify/rag-web-browser',
        'clockworks/free-tiktok-scraper',
        'compass/crawler-google-places',
        'lukaskrivka/google-maps-with-contact-details',
        'voyager/booking-scraper',
    ],
};

export enum InternalTools {
    SEARCH_ACTORS = 'search-actors',
    ADD_ACTOR_TO_TOOLS = 'add-actor-to-tools',
    REMOVE_ACTOR_FROM_TOOLS = 'remove-actor-from-tools',
}

export enum Routes {
    ROOT = '/',
    SSE = '/sse',
    MESSAGE = '/message',
}
