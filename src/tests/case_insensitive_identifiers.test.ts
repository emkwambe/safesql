import { describe, expect, it } from 'vitest';
import { validateSQL } from '../services/sqlValidator';
import { parseDDL } from '../services/schemaParser';

// Sprint 5B fix 1 — unquoted SQL identifiers are case-insensitive. PostgreSQL
// folds them to lower case, so `CustomerID` and `customerid` are the same
// column. Found by the Spider benchmark, where case-sensitive comparison
// produced 627 spurious HALLUCINATED_* findings on expert-written queries.

const DDL = `
CREATE TABLE Singer (Singer_ID NUMERIC PRIMARY KEY, Name TEXT, Country TEXT, Age NUMERIC);
CREATE TABLE Concert (Concert_ID NUMERIC PRIMARY KEY, CustomerID NUMERIC REFERENCES Singer(Singer_ID), Theme TEXT);
`;

const schema = parseDDL(DDL);
const ids = (sql: string) => {
  const r = validateSQL({ sql, schema, dialect: 'postgresql' });
  return [...r.errors, ...r.warnings, ...r.suggestions].map((i) => i.id);
};

describe('case-insensitive identifier matching', () => {
  it('"CustomerID" == "customerid" — lower-case reference to a CamelCase column', () => {
    expect(ids('SELECT customerid FROM Concert;')).not.toContain('HALLUCINATED_COLUMN');
  });

  it('accepts every casing of the same column', () => {
    for (const variant of ['CustomerID', 'customerid', 'CUSTOMERID', 'CustomerId']) {
      expect(ids(`SELECT ${variant} FROM Concert;`)).not.toContain('HALLUCINATED_COLUMN');
    }
  });

  it('lower-case table reference resolves to a CamelCase table', () => {
    expect(ids('SELECT name, country, age FROM singer;')).not.toContain('HALLUCINATED_TABLE');
    expect(ids('SELECT name, country, age FROM singer;')).not.toContain('HALLUCINATED_COLUMN');
  });

  it('the exact Spider query that produced the false positive is now silent', () => {
    // spider/0002_concert_singer against singer(Singer_ID, Name, Country, Age)
    expect(ids('SELECT name, country, age FROM singer ORDER BY age DESC')).toHaveLength(0);
  });

  it('qualified lower-case alias resolves against a CamelCase table', () => {
    expect(ids('SELECT s.name FROM Singer AS s;')).not.toContain('HALLUCINATED_COLUMN');
    expect(ids('SELECT S.Name FROM Singer AS s;')).not.toContain('UNKNOWN_ALIAS');
  });

  it('still flags a genuinely missing column, whatever its casing', () => {
    expect(ids('SELECT LifetimeValue FROM Singer;')).toContain('HALLUCINATED_COLUMN');
    expect(ids('SELECT lifetimevalue FROM Singer;')).toContain('HALLUCINATED_COLUMN');
  });

  it('still flags a genuinely missing table, whatever its casing', () => {
    expect(ids('SELECT id FROM Invoices;')).toContain('HALLUCINATED_TABLE');
    expect(ids('SELECT id FROM invoices;')).toContain('HALLUCINATED_TABLE');
  });

  it('still flags an undefined alias', () => {
    expect(ids('SELECT x.Name FROM Singer AS s;')).toContain('UNKNOWN_ALIAS');
  });
});
