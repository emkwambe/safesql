-- SafeSQL Pro benchmark — seeded suite schema.
--
-- Tables 1-3 (customers, subscriptions, payments) are copied VERBATIM from the
-- product demo DDL in src/pages/Editor.tsx. They are the schema the flagship
-- AGGREGATE_OVER_FANOUT_JOIN query runs against and are known-good.
--
-- Tables 4-6 are benchmark extensions, added because six detectors have no
-- trigger surface in the three demo tables (integer division needs INT columns,
-- SCD needs a versioned dimension, the bare-scan time-filter trigger needs an
-- event/log table). They follow the same conventions.

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  country TEXT,
  plan TEXT CHECK (plan IN ('free','pro','business')),
  created_at DATE
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  plan TEXT,
  amount NUMERIC(10,2),
  status TEXT CHECK (status IN ('active','cancelled','past_due')),
  started_at DATE,
  cancelled_at DATE
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  customer_id UUID REFERENCES customers(id),
  amount NUMERIC(10,2),
  status TEXT CHECK (status IN ('succeeded','failed','refunded')),
  paid_at DATE
);

-- ── Benchmark extensions ────────────────────────────────────────────────────

-- Integer columns, for INTEGER_DIVISION_RISK and COUNT_STAR_VS_COUNT_COL.
CREATE TABLE usage_counters (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  queries_run INTEGER,
  queries_failed INTEGER,
  seats_used INTEGER,
  recorded_on DATE
);

-- Slowly-changing dimension, for SCD_JOIN_WITHOUT_EFFECTIVE_DATE. Named to match
-- the detector's SCD_NAME_RE (/history|log|audit|version|snapshot/i).
CREATE TABLE customer_history (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  segment TEXT,
  valid_from DATE,
  valid_to DATE,
  is_current TEXT CHECK (is_current IN ('Y','N'))
);

-- Append-only event log, for MISSING_TIME_FILTER's bare-scan trigger.
CREATE TABLE events (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  event_type TEXT,
  event_value NUMERIC(10,2),
  occurred_at TIMESTAMP
);

-- Small reference table (< 500 rows), for ambiguous case #4 in METHODOLOGY.md.
CREATE TABLE countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT
);
