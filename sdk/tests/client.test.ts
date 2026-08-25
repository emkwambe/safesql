import { describe, expect, it } from 'vitest';
import { SafeSQLClient, SafeSQLError, verdictFor, toValidationResult } from '../src/index';
import type { FetchLike } from '../src/index';

const FANOUT_REPORT = {
  riskScore: 25,
  processingMs: 12,
  errors: [
    {
      id: 'AGGREGATE_OVER_FANOUT_JOIN',
      severity: 'error',
      description: 'JOIN on orders multiplies rows before SUM(amount)',
      fix: 'Pre-aggregate orders before joining',
      scoreImpact: -35,
      offendingClause: 'JOIN',
      offendingTable: 'orders',
    },
  ],
  warnings: [
    {
      id: 'SELECT_STAR_EXPENSIVE',
      severity: 'warning',
      description: 'SELECT * reads every column',
      fix: 'Name the columns you need',
      scoreImpact: -5,
    },
  ],
  suggestions: [],
};

interface Call {
  url: string;
  init?: RequestInit;
}

function mockFetch(
  body: unknown,
  status = 200,
): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

describe('SafeSQLClient', () => {
  it('requires an API key', () => {
    expect(() => new SafeSQLClient({ apiKey: '' })).toThrow(/apiKey is required/);
  });

  it('requires sql', async () => {
    const { fetch } = mockFetch(FANOUT_REPORT);
    const client = new SafeSQLClient({ apiKey: 'ssk_test', fetch });
    await expect(client.validate({ sql: '   ' })).rejects.toThrow(/sql is required/);
  });

  it('POSTs to /api/validate with a Bearer key and JSON body', async () => {
    const { fetch, calls } = mockFetch(FANOUT_REPORT);
    const client = new SafeSQLClient({ apiKey: 'ssk_test', fetch });
    await client.validate({ sql: 'SELECT 1', ddl: 'CREATE TABLE t (id INT);', dialect: 'mysql' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://safesqlpro.dev/api/validate');
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ssk_test');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      sql: 'SELECT 1',
      ddl: 'CREATE TABLE t (id INT);',
      dialect: 'mysql',
    });
  });

  it('defaults dialect to postgresql and ddl to empty', async () => {
    const { fetch, calls } = mockFetch(FANOUT_REPORT);
    await new SafeSQLClient({ apiKey: 'k', fetch }).validate({ sql: 'SELECT 1' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      sql: 'SELECT 1',
      ddl: '',
      dialect: 'postgresql',
    });
  });

  it('honours a custom baseUrl (trailing slash stripped)', async () => {
    const { fetch, calls } = mockFetch(FANOUT_REPORT);
    const client = new SafeSQLClient({ apiKey: 'k', baseUrl: 'https://safesql.pages.dev/', fetch });
    await client.validate({ sql: 'SELECT 1' });
    expect(calls[0].url).toBe('https://safesql.pages.dev/api/validate');
  });

  it('maps the report to ValidationResult (id → issueType, description → message)', async () => {
    const { fetch } = mockFetch(FANOUT_REPORT);
    const result = await new SafeSQLClient({ apiKey: 'k', fetch }).validate({ sql: 'SELECT 1' });

    expect(result.score).toBe(25);
    expect(result.verdict).toBe('CRITICAL');
    expect(result.valid).toBe(false);
    expect(result.executionTime).toBe(12);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].issueType).toBe('AGGREGATE_OVER_FANOUT_JOIN');
    expect(result.issues[0].message).toMatch(/multiplies rows/);
    expect(result.issues[0].fix).toBe('Pre-aggregate orders before joining');
    expect(result.issues[0].scoreImpact).toBe(-35);
    expect(result.issues[0].offendingTable).toBe('orders');
    // errors first, then warnings
    expect(result.issues[1].severity).toBe('warning');
  });

  it('valid reflects the threshold', async () => {
    const { fetch } = mockFetch({ riskScore: 75, processingMs: 1, errors: [], warnings: [], suggestions: [] });
    const client = new SafeSQLClient({ apiKey: 'k', fetch });
    expect((await client.validate({ sql: 'SELECT 1' })).valid).toBe(true);
    expect((await client.validate({ sql: 'SELECT 1', threshold: 85 })).valid).toBe(false);
  });

  it('throws SafeSQLError with the API message on 401', async () => {
    const { fetch } = mockFetch({ error: 'Invalid API key. Get yours at https://safesqlpro.dev/settings' }, 401);
    const client = new SafeSQLClient({ apiKey: 'bad', fetch });
    await expect(client.validate({ sql: 'SELECT 1' })).rejects.toBeInstanceOf(SafeSQLError);
    await expect(client.validate({ sql: 'SELECT 1' })).rejects.toThrow(/Invalid API key/);
  });

  it('throws SafeSQLError carrying the status on 429', async () => {
    const { fetch } = mockFetch({ error: 'Rate limit exceeded' }, 429);
    const client = new SafeSQLClient({ apiKey: 'k', fetch });
    await client.validate({ sql: 'SELECT 1' }).then(
      () => expect.unreachable('should have thrown'),
      (err: SafeSQLError) => {
        expect(err.status).toBe(429);
        expect(err.name).toBe('SafeSQLError');
      },
    );
  });

  it('throws SafeSQLError on a non-JSON response', async () => {
    const fetch: FetchLike = async () => new Response('<html>502</html>', { status: 502 });
    const client = new SafeSQLClient({ apiKey: 'k', fetch });
    await expect(client.validate({ sql: 'SELECT 1' })).rejects.toThrow(/non-JSON response/);
  });
});

describe('verdictFor', () => {
  it('maps the score policy bands', () => {
    expect(verdictFor(0)).toBe('CRITICAL');
    expect(verdictFor(40)).toBe('CRITICAL');
    expect(verdictFor(41)).toBe('RISKY');
    expect(verdictFor(69)).toBe('RISKY');
    expect(verdictFor(70)).toBe('REVIEW');
    expect(verdictFor(84)).toBe('REVIEW');
    expect(verdictFor(85)).toBe('CLEAN');
    expect(verdictFor(100)).toBe('CLEAN');
  });
});

describe('toValidationResult', () => {
  it('tolerates a report with missing fields', () => {
    const result = toValidationResult({}, 70);
    expect(result).toEqual({ valid: false, score: 0, verdict: 'CRITICAL', issues: [], executionTime: 0 });
  });

  it('falls back to the bucket severity when the issue omits one', () => {
    const result = toValidationResult({ riskScore: 90, warnings: [{ id: 'X' }] }, 70);
    expect(result.issues[0]).toMatchObject({ issueType: 'X', severity: 'warning', message: '', fix: '', scoreImpact: 0 });
  });
});
