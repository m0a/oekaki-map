import { describe, it, expect } from 'vitest';
import { isCrawler, getCrawlerName } from '../src/utils/crawler';

describe('isCrawler', () => {
  // LINE's OGP crawler uses facebookexternalhit, tested separately
  // LINE in-app browser should NOT be detected as crawler
  it('should not detect LINE in-app browser as crawler', () => {
    // LINE in-app browser User-Agent contains "Line/" but is a real browser
    expect(
      isCrawler(
        'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36 Line/14.0.0'
      )
    ).toBe(false);
  });

  it('should detect Twitterbot', () => {
    expect(isCrawler('Twitterbot/1.0')).toBe(true);
    expect(isCrawler('Mozilla/5.0 Twitterbot/1.0')).toBe(true);
  });

  it('should detect Facebook crawler', () => {
    expect(isCrawler('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawler('Mozilla/5.0 facebookexternalhit/1.1')).toBe(true);
  });

  it('should detect Slackbot', () => {
    expect(isCrawler('Slackbot-LinkExpanding 1.0')).toBe(true);
  });

  it('should detect Discordbot', () => {
    expect(isCrawler('Mozilla/5.0 Discordbot/2.0')).toBe(true);
  });

  it('should detect Googlebot', () => {
    expect(isCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
  });

  it('should not detect regular browser', () => {
    expect(
      isCrawler(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      )
    ).toBe(false);
  });

  it('should handle null or undefined user agent', () => {
    expect(isCrawler(null)).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
    expect(isCrawler('')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(isCrawler('TWITTERBOT/1.0')).toBe(true);
    expect(isCrawler('twitterbot/1.0')).toBe(true);
    expect(isCrawler('TwitterBot/1.0')).toBe(true);
  });
});

describe('getCrawlerName', () => {
  it('should return crawler name for known crawlers', () => {
    expect(getCrawlerName('Twitterbot/1.0')).toBe('twitterbot');
    expect(getCrawlerName('facebookexternalhit/1.1')).toBe('facebookexternalhit');
    expect(getCrawlerName('Slackbot-LinkExpanding 1.0')).toBe('slackbot');
  });

  it('should return null for LINE in-app browser', () => {
    expect(getCrawlerName('Mozilla/5.0 Line/14.0.0')).toBe(null);
  });

  it('should return null for regular browsers', () => {
    expect(getCrawlerName('Mozilla/5.0 Chrome/91.0')).toBe(null);
  });

  it('should return null for null or undefined', () => {
    expect(getCrawlerName(null)).toBe(null);
    expect(getCrawlerName(undefined)).toBe(null);
  });
});
