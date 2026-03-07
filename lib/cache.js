import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write cache file to disk.
 *
 * @async
 * @function writeCache
 * @param {string} cacheFile - Absolute or relative path to the cache file.
 * @param {number} cacheLimit - Maximum number of items allowed in the cache.
 * @param {string[]} cache - Array of cache entries (typically hashes).
 * @returns {Promise<void>} Resolves when the cache has been written.
 *
 * @throws {Error} If the provided cache is not an array.
 *
 * @example
 * await writeCache('.bsky-bot/cache.json', 200, cacheHashes);
 */
export async function writeCache(cacheFile, cacheLimit, cache) {
  try {
    if (!Array.isArray(cache)) {
      throw new Error('Cache must be an array');
    }

    // enforce cache size limit
    if (cache.length > cacheLimit) {
      const removeCount = cache.length - cacheLimit;
      console.info(`Cache limit reached. Removing ${removeCount} items.`);
      cache = cache.slice(-cacheLimit);
    }

    await mkdir(path.dirname(cacheFile), { recursive: true });

    // atomic write (prevents corruption)
    const tmpFile = `${cacheFile}.tmp`;

    await writeFile(tmpFile, JSON.stringify(cache), 'utf8');
    await rename(tmpFile, cacheFile);
  } catch (error) {
    console.error(`Failed to write cache file: ${error.message}`);
  }
}

/**
 * Read cache file from disk.
 *
 * @async
 * @function getCache
 * @param {string} cacheFile - Path to the cache file.
 * @returns {Promise<string[]>} Resolves with the cache contents as an array.
 *
 * @example
 * const cache = await getCache('.bsky-bot/cache.json');
 */
export async function getCache(cacheFile) {
  try {
    const data = await readFile(cacheFile, 'utf8');
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      throw new Error('Cache file invalid');
    }

    return parsed;
  } catch (_error) {
    console.debug(`Cache not found or invalid: ${cacheFile}`);
    return [];
  }
}
