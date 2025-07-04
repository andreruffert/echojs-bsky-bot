import { existsSync } from 'node:fs';
import path from 'node:path';
import { AtpAgent, RichText } from '@atproto/api';
import sharp from 'sharp';
import { getCache, writeCache } from './cache.js';
import { bskyAccount, bskyService } from './config.js';
import { getRss, getUrlMetadata, sha256 } from './utils.js';

export default class Bot {
  #agent;

  static defaultOptions = {
    service: bskyService,
    cacheFile: path.join(process.cwd(), '.bsky-bot', 'cache.json'),
    cacheLimit: 100,
    initialPostLimit: 1,
    postLimit: 1,
    dryRun: false,
  };

  constructor(service) {
    this.#agent = new AtpAgent({ service });
  }

  login(loginOpts) {
    return this.#agent.login(loginOpts);
  }

  /**
   *
   * @param {object} item
   * @param {string} item.title
   * @param {string} item.link
   * @returns
   */
  async post(item) {
    let richText = new RichText({
      text: `${item.title}

${item.comments}

${item.link}`,
    });

    if (richText.graphemeLength >= 300) {
      richText = new RichText({
        text: rt.unicodeText.slice(0, 300),
      });
    }

    await richText.detectFacets(this.#agent);
    // console.debug(`RichText:\n\n${JSON.stringify(richText.text, null, 2)}`);

    const embedCard = await getBskyEmbedCard(item.link, this.#agent);
    // console.debug(`EmbedCard:\n\n${JSON.stringify(embedCard, null, 2)}`);

    const record = {
      $type: 'app.bsky.feed.post',
      text: richText.text,
      facets: richText.facets,
      embed: embedCard,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };
    console.debug(`Record:\n\n${JSON.stringify(record, null, 2)}`);

    return this.#agent.post(record);
  }

  static async run(rssFeedURL, botOptions) {
    const { service, cacheFile, cacheLimit, initialPostLimit, postLimit, dryRun } = botOptions
      ? Object.assign({}, Bot.defaultOptions, botOptions)
      : Bot.defaultOptions;

    const bot = new Bot(service);
    await bot.login(bskyAccount);

    // get the rss feed
    const feedData = await getRss(rssFeedURL);
    const feedEntries = feedData?.rss?.channel?.item ?? [];
    console.debug(`Pre-filter feed items:\n\n${JSON.stringify(feedEntries, null, 2)}`);

    let limit = postLimit;
    let cache = [];

    // get the cache
    if (!existsSync(cacheFile)) {
      limit = initialPostLimit;
    } else {
      cache = await getCache(cacheFile);
    }

    // Prevent duplicate posts (filter out the cached items).
    // Reverse to post in the published order.
    const newEntries = filterCachedItems(feedEntries, cache).reverse();
    console.debug(`Post-filter feed items:\n\n${JSON.stringify(newEntries, null, 2)}`);

    if (!dryRun) {
      // post the new items
      let postedItems = 0;
      for (const item of newEntries) {
        try {
          const hash = sha256(item.link);
          console.debug(`Posting: '${item.title}' with hash ${hash}`);

          if (postedItems >= limit) {
            console.debug(`Skipping: '${item.title}' with hash ${hash} due to post limit ${limit}`);
          } else {
            // post the item
            const res = await bot.post(item);
            console.debug(`Response:\n\n${JSON.stringify(res, null, 2)}`);

            if (res) {
              postedItems++;
              // add the item to the cache
              cache.push(hash);
            }
          }
        } catch (error) {
          console.error(`Failed to post item: ${error.message}`);
        }
      }
    } else {
      console.debug('dryRun:', { newEntries });
    }

    // write the cache
    if (cache.length) {
      await writeCache(cacheFile, cacheLimit, cache);
    }

    return newEntries;
  }
}

function filterCachedItems(feedEntries = [], cache = []) {
  let newEntries = feedEntries;

  if (cache.length) {
    newEntries = newEntries?.filter((item) => {
      const hash = sha256(item.link);
      return !cache.includes(hash);
    });
    //?.sort((a, b) => a.published?.localeCompare(b.published || '') || NaN);
  }

  return newEntries;
}

async function getBskyEmbedCard(url, agent) {
  if (!url || !agent) return;

  try {
    const metadata = await getUrlMetadata(url);
    const blob = await fetch(metadata?.['og:image']).then((r) => r.blob());

    // Resize image to prevent "File size is to large" failed to post error e.g.
    // https://github.com/andreruffert/echojs-bsky-bot/actions/runs/15849983821/job/44680817690#step:7:291
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageOptions = { width: 1200, height: 630 };
    const resizedImage = await sharp(buffer).resize(imageOptions).toFormat('jpeg').toBuffer();
    const { data } = await agent.uploadBlob(resizedImage, { encoding: 'image/jpeg' });

    return {
      $type: 'app.bsky.embed.external',
      external: {
        uri: url,
        title: metadata.title,
        description: metadata.description,
        thumb: data.blob,
      },
    };
  } catch (error) {
    console.error('Error fetching embed card:', error);
    return;
  }
}
