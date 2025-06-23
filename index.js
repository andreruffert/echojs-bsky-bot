import path from 'node:path';
import { parseArgs } from 'node:util';
import Bot from './lib/bot.js';

const options = {
  'rss-feed': {
    type: 'string',
    required: true,
  },
  'cache-file': {
    type: 'string',
    default: path.join(process.cwd(), '.bsky-bot', 'cache.json'),
  },
  'cache-limit': {
    type: 'string',
    default: '100',
  },
  'initial-post-limit': {
    type: 'string',
    default: '1',
  },
  'post-limit': {
    type: 'string',
    default: '1',
  },
  'dry-run': {
    type: 'boolean',
    default: false,
  },
};

const { values } = parseArgs({ args: process.argv.slice(2), options });
const rssFeedURL = values['rss-feed'];
const botOptions = {
  cacheFile: values['cache-file'],
  cacheLimit: Number(values['cache-limit']),
  initialPostLimit: Number(values['initial-post-limit']),
  postLimit: Number(values['post-limit']),
  dryRun: values['dry-run'],
};

const res = await Bot.run(rssFeedURL, botOptions);
console.debug(`[${new Date().toISOString()}] bot:\n\n${JSON.stringify(res, null, 2)}`);
