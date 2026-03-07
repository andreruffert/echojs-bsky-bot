/**
 * @import {BotOptions, LoggerOptions, Logger } from './types.js'
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import Bot from './lib/bot.js';
import { bskyService } from './lib/config.js';

/**
 * Create a prefixed console logger.
 *
 * Prefixes output depending on run mode:
 * - `[BOT]` normal operation
 * - `[DRY-RUN]` simulation mode
 * - `[CACHE]` cache population mode
 *
 * @param {LoggerOptions} [options]
 * @returns {Logger}
 */
function createLogger({ dryRun = false, populateCache = false } = {}) {
  const prefix = populateCache ? '[CACHE]' : dryRun ? '[DRY-RUN]' : '[BOT]';

  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

/**
 * Parse CLI arguments into structured options.
 *
 * @returns {BotOptions}
 */
function parseCLIArgs() {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'cache-file': { type: 'string', default: '.bsky-bot/cache.json' },
      'cache-limit': { type: 'string', default: '100' },
      'initial-post-limit': { type: 'string', default: '1' },
      'post-limit': { type: 'string', default: '1' },
      'dry-run': { type: 'boolean', default: false },
      'populate-cache': { type: 'boolean', default: false },
    },
  });

  return {
    cacheFile: path.resolve(args['cache-file']),
    cacheLimit: Number(args['cache-limit']),
    initialPostLimit: Number(args['initial-post-limit']),
    postLimit: Number(args['post-limit']),
    dryRun: args['dry-run'],
    populateCache: args['populate-cache'],
  };
}

/**
 * Handle fatal errors by logging and exiting the process.
 *
 * @param {unknown} error
 * @param {string} label
 * @returns {never}
 */
function fatalError(error, label) {
  console.error(`[BOT] ${label}:`, error);
  process.exit(1);
}

/**
 * Program entrypoint.
 * Parses CLI arguments, initializes the bot, and runs it.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseCLIArgs();
  const logger = createLogger(options);
  const bot = new Bot(bskyService, logger);

  await bot.run(options);
}

process.on('unhandledRejection', (error) => fatalError(error, 'Unhandled rejection'));
process.on('uncaughtException', (error) => fatalError(error, 'Uncaught exception'));

await main().catch((error) => fatalError(error, 'Fatal error'));
