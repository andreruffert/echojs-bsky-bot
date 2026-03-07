import path from 'node:path';
import { parseArgs } from 'node:util';
import Bot from './lib/bot.js';

/**
 * @typedef {Object} CLIOptions
 * @property {string} rssFeed - RSS feed URL
 * @property {string} cacheFile - Path to JSON cache
 * @property {number} cacheLimit - Maximum cache entries
 * @property {number} initialPostLimit - Number of posts if cache empty
 * @property {number} postLimit - Maximum posts per run
 * @property {boolean} dryRun - If true, skip posting
 */

/**
 * Parse CLI arguments
 * @returns {CLIOptions}
 */
function parseCLIArgs() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'rss-feed': { type: 'string', required: true },
      'cache-file': { type: 'string', default: path.join(process.cwd(), '.bsky-bot/cache.json') },
      'cache-limit': { type: 'string', default: '100' },
      'initial-post-limit': { type: 'string', default: '1' },
      'post-limit': { type: 'string', default: '1' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  return {
    rssFeed: values['rss-feed'],
    cacheFile: values['cache-file'],
    cacheLimit: Number(values['cache-limit']),
    initialPostLimit: Number(values['initial-post-limit']),
    postLimit: Number(values['post-limit']),
    dryRun: values['dry-run'],
  };
}

/**
 * Main entry point for the CLI bot
 */
async function main() {
  /** @type {CLIOptions} */
  const options = parseCLIArgs();

  try {
    await Bot.run(options);
  } catch (error) {
    console.error('Bot failed:', error);
    process.exit(1);
  }
}

// Run the CLI
await main();
