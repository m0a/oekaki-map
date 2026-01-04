// Crawler patterns for SNS and search engine bots
// Note: 'line' removed - too broad, matches LINE in-app browser
// LINE's OGP crawler uses 'facebookexternalhit' which is already included
const CRAWLER_PATTERNS = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'googlebot',
  'bingbot',
  'applebot',
  'whatsapp',
  'pinterest',
  'redditbot',
] as const;

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const lowerUA = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => lowerUA.includes(pattern));
}

export function getCrawlerName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const lowerUA = userAgent.toLowerCase();
  const matched = CRAWLER_PATTERNS.find((pattern) => lowerUA.includes(pattern));
  return matched ?? null;
}
