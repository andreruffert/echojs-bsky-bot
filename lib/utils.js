import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import urlMetadata from 'url-metadata';

export function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf-8').digest('hex');
}

export async function getRss(rssFeedURL) {
  const parser = new XMLParser();
  try {
    const XMLRes = await fetch(rssFeedURL);
    const XMLRaw = await XMLRes.text();
    const rss = parser.parse(XMLRaw);
    console.debug(`Pre-filter feed items:\n\n${JSON.stringify(rss, null, 2)}`);
    return rss;
  } catch (error) {
    console.error(`Failed to parse RSS feed: ${error.message}`);
  }
}

export async function getUrlMetadata(url) {
  try {
    const metadata = await urlMetadata(url);
    return metadata;
  } catch (error) {
    console.log(error);
  }
}
