import { env } from 'node:process';
import { z } from 'zod';

const envSchema = z.object({
  BSKY_HANDLE: z.string().min(1),
  BSKY_PASSWORD: z.string().min(1),
  BSKY_SERVICE: z.string().min(1).default('https://bsky.social'),
});

const parsed = envSchema.parse(env);

/**
 * @typedef AtpAgentLoginOpts
 *
 * @type AtpAgentLoginOpts
 */
export const bskyAccount = {
  identifier: parsed.BSKY_HANDLE,
  password: parsed.BSKY_PASSWORD,
};

export const bskyService = parsed.BSKY_SERVICE;
