import { describe, it, expect } from 'vitest';
import { parseDDL, stripSqlComments } from '../services/schemaParser';

// Regression: parseDDL kept only `;`-separated chunks starting with
// "CREATE TABLE", so one `--` comment pushed the keyword off the front of the
// chunk and every table after it vanished — surfacing as false
// HALLUCINATED_TABLE errors on real schemas. Found 2026-08-07.

const names = (ddl: string) => parseDDL(ddl).tables.map((t) => t.name);

describe('parseDDL — comment handling', () => {
  it('keeps tables that follow a -- comment between CREATE TABLE statements', () => {
    const ddl = `CREATE TABLE users (id UUID PRIMARY KEY, country TEXT);
-- Second child of users, joined alongside orders.
CREATE TABLE user_events (id UUID PRIMARY KEY, user_id UUID, event_type TEXT);`;
    expect(names(ddl)).toEqual(['users', 'user_events']);
  });

  it('keeps tables that follow a /* */ block comment', () => {
    const ddl = `CREATE TABLE users (id UUID PRIMARY KEY);
/* revenue tables below
   spanning several lines */
CREATE TABLE orders (id UUID PRIMARY KEY, total_amount NUMERIC(12,2));`;
    expect(names(ddl)).toEqual(['users', 'orders']);
  });

  it('handles a -- comment inside a column definition', () => {
    const ddl = `CREATE TABLE orders (
  id UUID PRIMARY KEY,
  total_amount NUMERIC(12,2), -- money, not an integer
  order_date DATE
);
CREATE TABLE refunds (id UUID PRIMARY KEY, order_id UUID);`;
    const parsed = parseDDL(ddl);
    expect(parsed.tables.map((t) => t.name)).toEqual(['orders', 'refunds']);
    // Column-level parsing is untouched by comment stripping.
    expect(parsed.tables[0].columns.map((c) => c.name)).toEqual([
      'id',
      'total_amount',
      'order_date',
    ]);
  });

  it('handles a block comment inside a column definition', () => {
    const ddl = `CREATE TABLE orders (
  id UUID PRIMARY KEY,
  total_amount /* cents */ NUMERIC(12,2)
);`;
    const parsed = parseDDL(ddl);
    expect(parsed.tables[0].columns.map((c) => c.name)).toEqual(['id', 'total_amount']);
  });

  it('parses clean DDL exactly as before (no regression)', () => {
    const ddl = `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('active','inactive','churned')),
  country TEXT
);
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total_amount NUMERIC(12,2)
);`;
    const parsed = parseDDL(ddl);
    expect(parsed.tables.map((t) => t.name)).toEqual(['users', 'orders']);
    expect(parsed.tables[0].columns.map((c) => c.name)).toEqual([
      'id',
      'email',
      'status',
      'country',
    ]);
  });

  it('does not treat -- or /* inside a string literal as a comment', () => {
    const ddl = `CREATE TABLE notes (
  id UUID PRIMARY KEY,
  kind TEXT CHECK (kind IN ('a--b','c/*d'))
);
CREATE TABLE after_it (id UUID PRIMARY KEY);`;
    // The table after the literal must survive — proof the literal did not
    // swallow the rest of the file as a comment.
    expect(names(ddl)).toEqual(['notes', 'after_it']);
  });
});

describe('stripSqlComments', () => {
  it('removes line comments but keeps the newline', () => {
    expect(stripSqlComments('SELECT 1 -- trailing\nSELECT 2')).toBe('SELECT 1 \nSELECT 2');
  });

  it('replaces a block comment with a space so tokens do not fuse', () => {
    expect(stripSqlComments('a/* x */b')).toBe('a b');
  });

  it('leaves string literals untouched', () => {
    expect(stripSqlComments(`'a--b'`)).toBe(`'a--b'`);
    expect(stripSqlComments(`'a/*b*/c'`)).toBe(`'a/*b*/c'`);
  });

  it('handles doubled-quote escapes inside literals', () => {
    expect(stripSqlComments(`'it''s -- fine' -- gone`)).toBe(`'it''s -- fine' `);
  });

  it('leaves quoted identifiers untouched', () => {
    expect(stripSqlComments('"col--name" -- gone')).toBe('"col--name" ');
  });

  it('terminates on an unterminated block comment', () => {
    expect(stripSqlComments('SELECT 1 /* never closed')).toBe('SELECT 1  ');
  });

  it('is a no-op on comment-free SQL', () => {
    const sql = 'CREATE TABLE t (id UUID PRIMARY KEY);';
    expect(stripSqlComments(sql)).toBe(sql);
  });
});
