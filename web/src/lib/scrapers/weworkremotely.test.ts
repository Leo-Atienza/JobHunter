import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeWeWorkRemotely } from './weworkremotely';

/** Minimal valid params for all tests. */
const BASE_PARAMS = {
  keywords: ['developer'],
  location: 'Remote',
  locations: ['Remote'],
  remote: true,
};

/** Wrap RSS item fields into a minimal valid RSS XML document. */
function buildRss(items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>We Work Remotely</title>
    ${items.join('\n    ')}
  </channel>
</rss>`;
}

/** Build a single RSS <item> block with optional fields. */
function rssItem({
  title = 'Acme Corp: Remote Developer',
  link = 'https://weworkremotely.com/jobs/1',
  pubDate = 'Sat, 15 Mar 2026 10:00:00 +0000',
  description = '<![CDATA[<p>Great job opportunity.</p>]]>',
}: {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
} = {}): string {
  return `<item>
    <title><![CDATA[${title}]]></title>
    <link>${link}</link>
    <pubDate>${pubDate}</pubDate>
    <description>${description}</description>
  </item>`;
}

/** Build a mock fetch that returns the given text body. */
function mockFetch(body: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => body,
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(buildRss([])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrapeWeWorkRemotely', () => {
  it('returns empty jobs on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch('', 503));
    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.source).toBe('weworkremotely');
    expect(result.jobs).toEqual([]);
  });

  it('returns empty jobs on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')));
    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toEqual([]);
  });

  it('parses a standard "Company: Title" item correctly', async () => {
    const xml = buildRss([
      rssItem({
        title: 'Acme Corp: Senior Developer',
        link: 'https://weworkremotely.com/jobs/42',
        pubDate: 'Sat, 15 Mar 2026 10:00:00 +0000',
        description: '<![CDATA[<p>Build great things.</p>]]>',
      }),
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.company).toBe('Acme Corp');
    expect(job.title).toBe('Senior Developer');
    expect(job.url).toBe('https://weworkremotely.com/jobs/42');
    expect(job.location).toBe('Remote');
    expect(job.source).toBe('weworkremotely');
    expect(job.description).toBe('Build great things.');
  });

  it('uses full title when there is no ": " separator', async () => {
    const xml = buildRss([rssItem({ title: 'Freelance Frontend Developer' })]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Freelance Frontend Developer');
    expect(result.jobs[0].company).toBeUndefined();
  });

  it('sets location to "Remote" for all jobs', async () => {
    const xml = buildRss([rssItem()]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs[0].location).toBe('Remote');
  });

  it('strips HTML tags from description', async () => {
    const xml = buildRss([
      rssItem({ description: '<![CDATA[<b>Exciting</b> <em>role</em> available.]]>' }),
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs[0].description).toBe('Exciting role available.');
  });

  it('filters out items whose title does not match any keyword', async () => {
    const xml = buildRss([
      rssItem({ title: 'Acme: Marketing Manager' }),
      rssItem({ title: 'Beta Corp: Senior Developer', link: 'https://weworkremotely.com/jobs/2' }),
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Senior Developer');
  });

  it('returns all matching jobs from multiple items', async () => {
    const xml = buildRss([
      rssItem({ title: 'Alpha: Developer', link: 'https://weworkremotely.com/jobs/1' }),
      rssItem({ title: 'Beta: Developer', link: 'https://weworkremotely.com/jobs/2' }),
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(2);
  });

  it('handles items with missing pubDate gracefully', async () => {
    const xml = buildRss([
      `<item>
        <title><![CDATA[Acme Corp: Remote Developer]]></title>
        <link>https://weworkremotely.com/jobs/5</link>
      </item>`,
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].posted_date).toBeUndefined();
  });

  it('skips items that have no link field', async () => {
    const xml = buildRss([
      `<item>
        <title><![CDATA[Acme Corp: Remote Developer]]></title>
      </item>`,
    ]);
    vi.stubGlobal('fetch', mockFetch(xml));

    const result = await scrapeWeWorkRemotely(BASE_PARAMS);
    expect(result.jobs).toHaveLength(0);
  });
});
