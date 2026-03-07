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

/**
 * Truncate text to a maximum number of graphemes.
 *
 * @param {string[]} parts - Text parts to join
 * @param {{max?: number, sep?: string}} [opts] - Options
 * @param {number} [opts.max=300] - Maximum number of graphemes allowed
 * @param {string} [opts.sep='\n\n'] - Separator between parts
 * @returns {string} - Text truncated with ellipsis if over max
 */
export function truncateText(parts, { max = 300, sep = '\n\n' } = {}) {
  const filtered = parts.filter(Boolean);
  let text = filtered.join(sep);

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemes = Array.from(segmenter.segment(text));

  if (graphemes.length <= max) return text;

  // truncate gradually by removing parts from the end
  const truncatedParts = [...filtered];
  while (truncatedParts.length) {
    text = truncatedParts.join(sep);
    if (Array.from(segmenter.segment(text)).length <= max) break;
    truncatedParts.pop();
  }

  // if text still too long, truncate first part only
  let finalText = truncatedParts.join(sep);
  const finalGraphemes = Array.from(segmenter.segment(finalText));
  if (finalGraphemes.length > max) {
    finalText = finalGraphemes
      .slice(0, max - 1)
      .map((s) => s.segment)
      .join('');
  }

  return `${finalText}…`;
}
