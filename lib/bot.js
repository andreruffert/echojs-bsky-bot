/**
 * @import {BotOptions, Logger, FeedItem, HashedFeedItem} from './types.js'
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { AtpAgent } from '@atproto/api';
import { getCache, writeCache } from './cache.js';
import { bskyAccount, rssFeed } from './config.js';
import { createPostRecord } from './post.js';
import { getRss, sha256 } from './utils.js';

/**
 * Bot class for posting RSS items to Bluesky.
 */
export default class Bot {
  /**
   * Bluesky API agent.
   * @type {AtpAgent}
   */
  #agent;

  /** @type {Logger} */
  #logger;

  /**
   * @param {string} service - Bluesky service URL
   * @param {Logger} logger - Logger instance passed from index.js
   */
  constructor(service, logger) {
    this.#agent = new AtpAgent({ service });
    this.#logger = logger;
  }

  /**
   * Log in to Bluesky.
   * @returns {Promise<void>}
   */
  async login() {
    await this.#agent.login(bskyAccount);
  }

  /**
   * Post a single record to Bluesky.
   * @param {Object} record - Bluesky post record
   * @return {Promise<unknown>}
   */
  async post(record) {
    return this.#agent.post(record);
  }

  /**
   * Run the bot to process RSS items and post them.
   * @param {BotOptions} options
   * @returns {Promise<{posted: number, discovered: number}>}
   */
  async run(options) {
    const { cacheFile, cacheLimit, initialPostLimit, postLimit, dryRun, populateCache } = options;

    await fs.mkdir(path.dirname(cacheFile), { recursive: true });

    const entries = await this.#fetchFeed();

    if (!entries.length) {
      return { posted: 0, discovered: 0 };
    }

    const hashedEntries = this.#hashEntries(entries);

    const { cache, cacheSet, limit } = await this.#prepareCache(
      cacheFile,
      initialPostLimit,
      postLimit,
    );

    const newEntries = hashedEntries.filter((item) => !cacheSet.has(item.hash));

    if (!newEntries.length) {
      this.#logger.info('No new posts.');
      return { posted: 0, discovered: 0 };
    }

    const mode = populateCache ? 'caching' : dryRun ? 'simulating' : 'posting';

    if (!populateCache && !dryRun) {
      this.#logger.info('Logging into Bluesky…');
      await this.login();
    }

    const toProcess = populateCache ? newEntries : newEntries.slice(0, limit);

    this.#logger.info(`Found ${newEntries.length} new entries, ${mode} ${toProcess.length}.`);

    const { posted, cacheChanged } = await this.#processEntries({
      toProcess,
      cache,
      dryRun,
      populateCache,
    });

    await this.#finalizeCache(cacheFile, cacheLimit, cache, cacheChanged, dryRun);

    this.#logger.info(
      `Run complete → discovered=${newEntries.length}, processed=${posted}, dryRun=${dryRun}, populateCache=${populateCache}`,
    );

    return { posted, discovered: newEntries.length };
  }

  /**
   * Fetch RSS feed entries.
   * @returns {Promise<FeedItem[]>}
   */
  async #fetchFeed() {
    this.#logger.info('Fetching RSS feed…');

    const feed = await getRss(rssFeed);
    const entries = feed?.rss?.channel?.item ?? [];

    if (!entries.length) {
      this.#logger.info('Feed empty.');
    }

    return entries;
  }

  /**
   * Add hashes to feed entries.
   * @param {FeedItem[]} entries
   * @returns {HashedFeedItem[]}
   */
  #hashEntries(entries) {
    return entries.map((item) => ({
      ...item,
      hash: sha256(item.link),
    }));
  }

  /**
   * Load and prepare cache.
   * @param {string} cacheFile
   * @param {number} initialPostLimit
   * @param {number} postLimit
   * @returns {Promise<{cache: string[], cacheSet: Set<string>, limit: number}>}
   */
  async #prepareCache(cacheFile, initialPostLimit, postLimit) {
    const cache = await getCache(cacheFile).catch(() => []);
    const limit = cache.length ? postLimit : initialPostLimit;
    const cacheSet = new Set(cache);

    return { cache, cacheSet, limit };
  }

  /**
   * Process feed entries (post, simulate, or cache).
   * @param {{
   *   toProcess: HashedFeedItem[],
   *   cache: string[],
   *   dryRun: boolean,
   *   populateCache: boolean
   * }} params
   * @param {HashedFeedItem[]} params.toProcess
   * @param {string[]} params.cache
   * @param {boolean} params.dryRun
   * @param {boolean} params.populateCache
   * @returns {Promise<{posted:number, cacheChanged:boolean}>}
   */
  async #processEntries({ toProcess, cache, dryRun, populateCache }) {
    let posted = 0;
    let cacheChanged = false;

    /** @type {{text: string}[]} */
    let records = [];

    if (!populateCache && toProcess.length) {
      records = await Promise.all(
        toProcess.map((item) => createPostRecord(item, this.#agent, this.#logger)),
      );
    }

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];

      try {
        if (populateCache) {
          this.#logger.info(`Caching without posting: ${item.title}`);
          cache.push(item.hash);
          cacheChanged = true;
          posted++;
          continue;
        }

        const record = records[i];

        if (dryRun) {
          this.#logger.info('--- DRY RUN POST ---');
          this.#logger.info(record.text);
          this.#logger.info('--------------------\n');
        } else {
          this.#logger.info(`Posting: ${item.title}`);
          await this.post(record);
        }

        cache.push(item.hash);
        cacheChanged = true;
        posted++;

        this.#logger.info(`${dryRun ? 'Simulated' : 'Posted'}: ${item.title}`);
      } catch (error) {
        this.#logger.error(`Failed to process "${item.title}"`);
        this.#logger.error(error?.stack || error);
      }
    }

    return { posted, cacheChanged };
  }

  /**
   * Write cache file if needed.
   * @param {string} cacheFile
   * @param {number} cacheLimit
   * @param {string[]} cache
   * @param {boolean} cacheChanged
   * @param {boolean} dryRun
   */
  async #finalizeCache(cacheFile, cacheLimit, cache, cacheChanged, dryRun) {
    if (!dryRun && cacheChanged) {
      await writeCache(cacheFile, cacheLimit, cache);
    }
  }
}
