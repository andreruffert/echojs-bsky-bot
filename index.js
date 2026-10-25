import { parseArgs } from 'node:util';
import Bot from 'bsky-rss-bot';

/**
 * Parse CLI arguments into structured options.
 */
function parseCLIArgs() {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'initial-post-limit': { type: 'string', default: '1' },
      'post-limit': { type: 'string', default: '1' },
      'dry-run': { type: 'boolean', default: false },
      'populate-cache': { type: 'boolean', default: false },
    },
  });

  return {
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
  const bot = new Bot({
    feedUrl: process.env.RSS_FEED,
    account: {
      identifier: process.env.BSKY_HANDLE,
      password: process.env.BSKY_PASSWORD,
    },
    getEntries: (feed) =>
      feed.rss.channel.item.map((entry) => ({
        title: entry.title,
        link: entry.link,
        comments: entry.comments,
      })),
    postText: (item) => [item.title, item.comments, '#JavaScript'].join('\n\n'),
  });

  await bot.run(options);
}

process.on('unhandledRejection', (error) => fatalError(error, 'Unhandled rejection'));
process.on('uncaughtException', (error) => fatalError(error, 'Uncaught exception'));

await main().catch((error) => fatalError(error, 'Fatal error'));
