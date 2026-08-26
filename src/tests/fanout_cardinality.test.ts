import { describe, expect, it } from 'vitest';
import { validateSQL } from '../services/sqlValidator';
import { parseDDL } from '../services/schemaParser';

// Sprint 5B fix 2 — cardinality-aware fan-out detection.
// A join whose ON clause equates the JOINED table's primary key matches at most
// one row, so it cannot multiply rows. Found by the BIRD benchmark, where
// `card JOIN disp ON card.disp_id = disp.disp_id` (disp_id is disp's PK) was
// reported as a fan-out that provably does not occur.

const DDL = `
CREATE TABLE client (client_id INTEGER PRIMARY KEY, gender TEXT);
CREATE TABLE disp (disp_id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES client(client_id), account_id INTEGER);
CREATE TABLE account (account_id INTEGER PRIMARY KEY, district_id INTEGER);
CREATE TABLE trans (trans_id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES account(account_id), amount INTEGER);
CREATE TABLE card (card_id INTEGER PRIMARY KEY, disp_id INTEGER REFERENCES disp(disp_id));
CREATE TABLE loan (loan_id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES account(account_id), amount INTEGER);
`;
const schema = parseDDL(DDL);
const ids = (sql: string) => {
  const r = validateSQL({ sql, schema, dialect: 'postgresql' });
  return [...r.errors, ...r.warnings, ...r.suggestions].map((i) => i.id);
};

describe('cardinality-aware fan-out detection', () => {
  it('JOIN on the target primary key does not flag fan-out', () => {
    // bird/0144 — card joins disp on disp's PK, so at most one disp per card.
    expect(
      ids(`SELECT AVG(T4.amount) FROM card AS T1
           INNER JOIN disp AS T2 ON T1.disp_id = T2.disp_id
           INNER JOIN account AS T3 ON T2.account_id = T3.account_id
           INNER JOIN trans AS T4 ON T3.account_id = T4.account_id`),
    ).not.toContain('AGGREGATE_OVER_FANOUT_JOIN');
  });

  it('a simple PK join with an aggregate stays silent', () => {
    expect(
      ids(`SELECT SUM(t.amount) FROM trans t
           JOIN account a ON t.account_id = a.account_id`),
    ).not.toContain('AGGREGATE_OVER_FANOUT_JOIN');
  });

  it('REGRESSION: a genuine fan-out on non-unique keys is still flagged', () => {
    // Two child tables joined on the same non-unique parent key — real fan-out.
    expect(
      ids(`SELECT SUM(t.amount) FROM account a
           JOIN trans t ON t.account_id = a.account_id
           JOIN loan l ON l.account_id = a.account_id`),
    ).toContain('AGGREGATE_OVER_FANOUT_JOIN');
  });

  it('REGRESSION: the seeded flagship defect still fires', () => {
    const seededDdl = parseDDL(`
      CREATE TABLE customers (id UUID PRIMARY KEY, plan TEXT);
      CREATE TABLE subscriptions (id UUID PRIMARY KEY, customer_id UUID REFERENCES customers(id), amount NUMERIC);
      CREATE TABLE payments (id UUID PRIMARY KEY, customer_id UUID REFERENCES customers(id), amount NUMERIC);
    `);
    const r = validateSQL({
      sql: `SELECT c.plan, SUM(p.amount) FROM customers c
            JOIN subscriptions s ON s.customer_id = c.id
            JOIN payments p ON p.customer_id = c.id
            GROUP BY c.plan`,
      schema: seededDdl,
      dialect: 'postgresql',
    });
    expect(r.errors.map((i) => i.id)).toContain('AGGREGATE_OVER_FANOUT_JOIN');
  });

  it('without a schema the guard is inert and behaviour is unchanged', () => {
    const r = validateSQL({
      sql: `SELECT SUM(t.amount) FROM account a
            JOIN trans t ON t.account_id = a.account_id
            JOIN loan l ON l.account_id = a.account_id`,
      dialect: 'postgresql',
    });
    expect([...r.errors, ...r.warnings].map((i) => i.id)).toContain('AGGREGATE_OVER_FANOUT_JOIN');
  });
});
