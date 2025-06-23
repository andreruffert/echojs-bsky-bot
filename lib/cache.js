import { mkdir, readFile, writeFile } from 'node:fs/promises';

export async function writeCache(cacheFile, cacheLimit, cache) {
  try {
    // limit the cache
    if (cache.length > cacheLimit) {
      console.info(`Cache limit reached. Removing ${cache.length - cacheLimit} items.`);
      cache = cache.slice(cache.length - cacheLimit);
    }

    // make sure the cache directory exists
    await mkdir(cacheFile.substring(0, cacheFile.lastIndexOf('/')), {
      recursive: true,
    });

    // write the cache
    await writeFile(cacheFile, JSON.stringify(cache));
  } catch (error) {
    console.error(`Failed to write cache file: ${error.message}`);
  }
}

/**
 *
 * @param {string} cacheFile
 * @returns Promise<string[]>
 */
export async function getCache(cacheFile) {
  let cache = [];
  try {
    cache = JSON.parse(await readFile(cacheFile, 'utf-8'));
    console.debug(`Cache: ${JSON.stringify(cache)}`);
    return cache;
  } catch (error) {
    console.debug(`Cache file not found. Creating new cache file at ${cacheFile}.`, error.message);
    return cache;
  }
}
