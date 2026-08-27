import { describe, expect, it } from 'vitest';
import { resolveActiveTab } from '../components/howto/UseCaseTabs';
import type { UseCaseId } from '../components/howto/types';

// Sprint 5D — the /how-to tab order puts dbt first but Analytics Engineer is
// the default. Falling back to the first entry instead of the configured
// default is the exact failure this guards.

const IDS: UseCaseId[] = [
  'dbt',
  'ai-sql',
  'analytics-engineer',
  'compliance',
  'engineering-lead',
];
const DEFAULT: UseCaseId = 'analytics-engineer';

describe('resolveActiveTab', () => {
  it('defaults to Analytics Engineer on a bare /how-to, not the first tab', () => {
    expect(resolveActiveTab('#/how-to', IDS, DEFAULT)).toBe('analytics-engineer');
    expect(resolveActiveTab('#/how-to', IDS, DEFAULT)).not.toBe('dbt');
  });

  it('defaults on an empty hash too', () => {
    expect(resolveActiveTab('', IDS, DEFAULT)).toBe('analytics-engineer');
  });

  it('Analytics Engineer is index 2 of the declared tab order', () => {
    expect(IDS.indexOf(DEFAULT)).toBe(2);
  });

  it('honours an explicit ?u= deep link for every tab', () => {
    for (const id of IDS) {
      expect(resolveActiveTab(`#/how-to?u=${id}`, IDS, DEFAULT)).toBe(id);
    }
  });

  it('falls back to the default for an unknown id, never to the first tab', () => {
    expect(resolveActiveTab('#/how-to?u=nonsense', IDS, DEFAULT)).toBe('analytics-engineer');
  });

  it('reads u= when it is not the first query parameter', () => {
    expect(resolveActiveTab('#/how-to?ref=slack&u=dbt', IDS, DEFAULT)).toBe('dbt');
  });
});
