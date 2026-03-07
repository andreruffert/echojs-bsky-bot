import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AtpAgent, RichText } from '@atproto/api';
import sharp from 'sharp';
import { getCache, writeCache } from './cache.js';
import { bskyAccount, bskyService } from './config.js';
import { getRss, getUrlMetadata, sha256 } from './utils.js';

/**
 * @typedef {Object} BotOptions
 * @property {string} rssFeed
 * @property {string} cacheFile
 * @property {number} cacheLimit
 * @property {number} initialPostLimit
 * @property {number} postLimit
 * @property {boolean} [dryRun]
 */

/**
 * @typedef {Object} FeedItem
 * @property {string} title
 * @property {string} link
 * @property {string} [comments]
 * @property {string} [pubDate]
 * @property {string} [hash]
 */

/**
 * Simple logger that prefixes dry-run runs
 */
function createLogger(dryRun = false) {
  const prefix = dryRun ? '[DRY-RUN]' : '[BOT]';

  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

export default class Bot {
  #agent;
  #logger;

  constructor(service, logger) {
    this.#agent = new AtpAgent({ service });
    this.#logger = logger;
  }

  async login() {
    await this.#agent.login(bskyAccount);
  }

  /**
   * Post a single feed item
   */
  async post(item, options) {
    const record = await createPostRecord(item, this.#agent);

    if (options.dryRun) {
      this.#logger.info('--- DRY RUN POST ---');
      this.#logger.info(record.text);
      this.#logger.info('--------------------\n');
      return { dryRun: true };
    }

    return this.#agent.post(record);
  }

  /**
   * Main bot runner
   */
  static async run(options) {
    const { rssFeed, cacheFile, cacheLimit, initialPostLimit, postLimit, dryRun } = options;

    const logger = createLogger(dryRun);

    await fs.mkdir(path.dirname(cacheFile), { recursive: true });

    const bot = new Bot(bskyService, logger);

    logger.info('Fetching RSS feed…');

    const feed = await getRss(rssFeed);
    const entries = feed?.rss?.channel?.item ?? [];

    if (!entries.length) {
      logger.info('Feed empty.');
      return { posted: 0, discovered: 0 };
    }

    const hashedEntries = entries.map((item) => ({
      ...item,
      hash: sha256(item.link),
    }));

    const cacheExists = existsSync(cacheFile);
    const cache = cacheExists ? await getCache(cacheFile) : [];
    const limit = cacheExists ? postLimit : initialPostLimit;

    const cacheSet = new Set(cache);

    const newEntries = hashedEntries
      .filter((item) => !cacheSet.has(item.hash))
      .sort((a, b) => new Date(a.pubDate || 0) - new Date(b.pubDate || 0));

    if (!newEntries.length) {
      logger.info('No new posts.');
      return { posted: 0, discovered: 0 };
    }

    logger.info('Logging into Bluesky…');
    await bot.login();

    const toPost = newEntries.slice(0, limit);

    logger.info(`Found ${newEntries.length} new entries, posting ${toPost.length}.`);

    let posted = 0;

    for (const item of toPost) {
      try {
        logger.info(`Posting: ${item.title}`);

        const res = await bot.post(item, options);

        const success = dryRun || !!res;

        if (success) {
          cache.push(item.hash);
          posted++;

          if (!dryRun) {
            await writeCache(cacheFile, cacheLimit, cache);
          }

          logger.info(`Posted successfully: ${item.title}`);
        }
      } catch (error) {
        logger.error(`Failed to post "${item.title}":`, error.message);
      }
    }

    logger.info(
      `Run complete → discovered=${newEntries.length}, posted=${posted}, dryRun=${dryRun}`,
    );

    return {
      posted,
      discovered: newEntries.length,
    };
  }
}

/**
 * Create a Bluesky post record
 */
async function createPostRecord(item, agent) {
  const text = composePost([item.title, item.comments, '#JavaScript']);
  const richText = new RichText({ text });
  await richText.detectFacets(agent);

  let embed;

  if (item.link) {
    embed = await getEmbedCard(item.link, agent);
  }

  return {
    $type: 'app.bsky.feed.post',
    text: richText.text,
    facets: richText.facets,
    embed,
    createdAt: new Date().toISOString(),
    langs: ['en'],
  };
}

/**
 * Generate embed card
 */
async function getEmbedCard(url, agent) {
  try {
    const metadata = await getUrlMetadata(url);

    const card = {
      uri: url,
      title: metadata?.title ?? url,
      description: metadata?.description ?? '',
    };

    if (!metadata?.['og:image']) {
      return { $type: 'app.bsky.embed.external', external: card };
    }

    const res = await fetch(metadata['og:image']);

    if (!res.ok) {
      return { $type: 'app.bsky.embed.external', external: card };
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    const resized = await sharp(buffer)
      .resize({ width: 1200, height: 630, fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const { data } = await agent.uploadBlob(resized, { encoding: 'image/jpeg' });

    return {
      $type: 'app.bsky.embed.external',
      external: { ...card, thumb: data.blob },
    };
  } catch (error) {
    console.warn('Embed generation failed:', error.message);

    return {
      $type: 'app.bsky.embed.external',
      external: { uri: url, title: url, description: '' },
    };
  }
}

/**
 * Compose post within Bluesky grapheme limits
 */
function composePost(parts, { max = 300, sep = '\n\n' } = {}) {
  const filtered = parts.filter(Boolean);

  let text = filtered.join(sep);

  if (new RichText({ text }).graphemeLength <= max) return text;

  for (let i = filtered.length - 1; i >= 0; i--) {
    filtered[i] = '';
    text = filtered.filter(Boolean).join(sep);

    if (new RichText({ text }).graphemeLength <= max) return text;
  }

  return `${text.slice(0, max - 1)}…`;
}
