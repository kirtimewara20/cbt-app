/**
 * Production Render API — override with API_PROXY_URL on Vercel if your service URL differs.
 */
export const PRODUCTION_API_ORIGIN =
  process.env.API_PROXY_URL || 'https://cbt-api-ktkr.onrender.com';

export const PRODUCTION_WS_ORIGIN =
  process.env.NEXT_PUBLIC_WS_URL || 'wss://cbt-api-ktkr.onrender.com';
