import { env } from 'node:process';
import { z } from 'zod';

/**
 * Environment variables schema for the Bluesky RSS Bot.
 */
const envSchema = z.object({
  BSKY_HANDLE: z.string().min(1),
  BSKY_PASSWORD: z.string().min(1),
  BSKY_SERVICE: z.string().min(1).default('https://bsky.social'),
  RSS_FEED: z.url().min(1),
});

/**
 * @typedef {z.infer<typeof envSchema>} EnvVars
 * Inferred environment variable types from the schema.
 */

/** @type {EnvVars} */
const parsed = envSchema.parse(env);

/**
 * Bluesky account login credentials for use with AtpAgent.
 * @type {{identifier: string, password: string}}
 * Automatically derived from EnvVars
 */
export const bskyAccount = {
  identifier: parsed.BSKY_HANDLE,
  password: parsed.BSKY_PASSWORD,
};

/** @readonly URL of the Bluesky service endpoint */
export const bskyService = parsed.BSKY_SERVICE;

/** @readonly RSS feed URL to fetch from */
export const rssFeed = parsed.RSS_FEED;
