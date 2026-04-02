import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeRemoteOK } from './remoteok';

/** Minimal valid params for all tests. */
const BASE_PARAMS = {
  keywords: ['typescript', 'developer'],
  location: 'Remote',
  locations: ['Remote'],
  remote: true,
};

/** Build a mock fetch that resolves with a JSON body. */
function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch([]));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrapeRemoteOK', () => {
  it('returns empty jobs array on null API response', async () => {
    vi.stubGlobal('fetch', mockFetch(null));
    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.source).toBe('remoteok');
    expect(result.jobs).toEqual([]);
  });

  it('returns empty jobs array on non-array API response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'rate limited' }));
    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs).toEqual([]);
  });

  it('returns empty jobs array on HTTP error response', async () => {
    vi.stubGlobal('fetch', mockFetch(null, 403));
    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs).toEqual([]);
  });

  it('skips the first element (API metadata) and maps job fields correctly', async () => {
    const apiResponse = [
      { legal: 'metadata entry, not a job' }, // index 0 — skipped
      {
        id: '123',
        position: 'TypeScript Developer',
        company: 'Acme Corp',
        location: 'Worldwide',
        tags: ['typescript', 'nodejs'],
        url: 'https://remoteok.com/jobs/123',
        salary_min: 80000,
        salary_max: 120000,
        date: '2026-03-15T10:00:00Z',
        description: 'Build cool things.',
      },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);

    const job = result.jobs[0];
    expect(job.title).toBe('TypeScript Developer');
    expect(job.company).toBe('Acme Corp');
    expect(job.location).toBe('Worldwide');
    expect(job.url).toBe('https://remoteok.com/jobs/123');
    expect(job.source).toBe('remoteok');
    expect(job.salary).toBe('$80,000 - $120,000');
    expect(job.skills).toBe('typescript, nodejs');
    expect(job.posted_date).toBe('2026-03-15');
    expect(job.description).toBe('Build cool things.');
  });

  it('defaults location to "Remote" when location field is missing', async () => {
    const apiResponse = [
      {},
      { id: '1', position: 'TypeScript developer', tags: ['typescript'] },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs[0].location).toBe('Remote');
  });

  it('builds fallback URL from id when url and apply_url are absent', async () => {
    const apiResponse = [
      {},
      { id: '99', position: 'TypeScript developer', tags: ['typescript'] },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs[0].url).toBe('https://remoteok.com/remote-jobs/99');
  });

  it('omits salary when only one salary bound is present', async () => {
    const apiResponse = [
      {},
      { id: '1', position: 'TypeScript developer', tags: ['typescript'], salary_min: 80000 },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs[0].salary).toBeUndefined();
  });

  it('filters out jobs that do not match any keyword', async () => {
    const apiResponse = [
      {},
      { id: '1', position: 'Marketing Manager', tags: ['marketing'], url: 'https://remoteok.com/jobs/1' },
      { id: '2', position: 'Senior TypeScript Developer', tags: ['typescript'], url: 'https://remoteok.com/jobs/2' },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe('Senior TypeScript Developer');
  });

  it('matches jobs by tag even if title does not contain keyword', async () => {
    const apiResponse = [
      {},
      {
        id: '5', position: 'Remote Engineer', company: 'Co',
        tags: ['typescript', 'react'],
        url: 'https://remoteok.com/jobs/5',
      },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    // keyword 'typescript' is in the tags, not the title
    const result = await scrapeRemoteOK({ ...BASE_PARAMS, keywords: ['typescript'] });
    expect(result.jobs).toHaveLength(1);
  });

  it('skips jobs with no position field', async () => {
    const apiResponse = [
      {},
      { id: '3', company: 'Ghost Corp', tags: ['typescript'], url: 'https://remoteok.com/jobs/3' },
    ];
    vi.stubGlobal('fetch', mockFetch(apiResponse));

    const result = await scrapeRemoteOK(BASE_PARAMS);
    expect(result.jobs).toHaveLength(0);
  });
});
