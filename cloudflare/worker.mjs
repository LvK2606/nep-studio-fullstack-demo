import { neon } from '@neondatabase/serverless';
import { handleRequest } from './handler.mjs';

export default {
  async fetch(request, env) {
    // /api/* and /admin reach the Worker; other requests are free static assets.
    const sql = env.DATABASE_URL ? neon(env.DATABASE_URL) : null;
    return handleRequest(request, env, sql);
  }
};
