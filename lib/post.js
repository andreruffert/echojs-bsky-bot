/**
 * @import {Logger, FeedItem, PostRecord} from './types.js'
 */

import { AtpAgent, RichText } from '@atproto/api';
import sharp from 'sharp';
import { getUrlMetadata, truncateText } from './utils.js';

/**
 * Create a Bluesky post record from an RSS feed item.
 *
 * @param {FeedItem} item
 * @param {AtpAgent} agent
 * @param {Logger} logger
 * @returns {Promise<PostRecord>}
 */
export async function createPostRecord(item, agent, logger) {
  const text = truncateText([item.title, item.comments, '#JavaScript']);
  const richText = new RichText({ text });
  await richText.detectFacets(agent);

  let embed;
  if (item.link) {
    embed = await getEmbedCard(item.link, agent, logger);
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
 * Generate an embed card for a URL.
 *
 * @param {string} url
 * @param {AtpAgent} agent
 * @param {Logger} logger
 * @returns {Promise<{ $type: string, external: { uri: string, title: string, description: string, thumb?: string } }>}
 */
async function getEmbedCard(url, agent, logger) {
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
    if (!res.ok) return { $type: 'app.bsky.embed.external', external: card };

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
    logger.warn('Embed generation failed:', error.message);
    return {
      $type: 'app.bsky.embed.external',
      external: { uri: url, title: url, description: '' },
    };
  }
}
