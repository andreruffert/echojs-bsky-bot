/**
 * CLI options parsed from command line arguments.
 * @typedef {Object} BotOptions
 * @property {string} cacheFile - Absolute path to cache JSON file
 * @property {number} cacheLimit - Maximum number of cache entries
 * @property {number} initialPostLimit - Posts allowed when cache is empty
 * @property {number} postLimit - Maximum posts per run
 * @property {boolean} dryRun - Simulate posts without sending them
 * @property {boolean} populateCache - Populate cache without posting
 */

/**
 * RSS feed item.
 * @typedef {Object} FeedItem
 * @property {string} title
 * @property {string} link
 * @property {string} [description]
 * @property {string} comments
 */

/**
 * Feed item with computed hash.
 * @typedef {FeedItem & {hash: string}} HashedFeedItem
 */

/**
 * Bluesky post record.
 * @typedef {Object} PostRecord
 * @property {string} $type
 * @property {string} text
 * @property {import('@atproto/api').RichTextFacet[]} facets
 * @property {Object} [embed]
 * @property {string} createdAt
 * @property {string[]} langs
 */

/**
 * Simple prefixed logger interface.
 * @typedef {Object} Logger
 * @property {(msg: string, ...args: unknown[]) => void} info
 * @property {(msg: string, ...args: unknown[]) => void} warn
 * @property {(msg: string, ...args: unknown[]) => void} error
 */

/**
 * Logger configuration options.
 * @typedef {Object} LoggerOptions
 * @property {boolean} [dryRun=false] - Simulate actions instead of executing them
 * @property {boolean} [populateCache=false] - Populate cache without posting
 */

export {};
