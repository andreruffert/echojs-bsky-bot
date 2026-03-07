import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import urlMetadata from 'url-metadata';

/** @type {XMLParser} Shared XML parser instance */
const XML_PARSER = new XMLParser();

/**
 * Generate a SHA256 hash of a string.
 *
 * @param {string} data - Input string to hash.
 * @returns {string} SHA256 hash in hexadecimal format.
 *
 * @example
 * const hash = sha256("hello");
 */
export function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Fetch and parse an RSS feed from a URL.
 *
 * @async
 * @param {string} rssFeedURL - URL of the RSS feed.
 * @returns {Promise<Object|null>} Parsed RSS object, or `null` if fetch/parse failed.
 *
 * @example
 * const feed = await getRss("https://example.com/feed.xml");
 */
export async function getRss(rssFeedURL) {
  try {
    const res = await fetch(rssFeedURL);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();
    return XML_PARSER.parse(xml);
  } catch (error) {
    console.error(`Failed to fetch/parse RSS feed: ${error.message}`);
    return null;
  }
}

/**
 * Fetch metadata for a URL for link preview / embed cards.
 *
 * @async
 * @param {string} url - URL to fetch metadata for.
 * @returns {Promise<Object|null>} Metadata object containing title, description, image, etc., or `null` if failed.
 * const meta = await getUrlMetadata("https://example.com/article");
 */
export async function getUrlMetadata(url) {
  try {
    return await urlMetadata(url);
  } catch (error) {
    console.warn(`Metadata fetch failed for ${url}: ${error.message}`);
    return null;
  }
}
