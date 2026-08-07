CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT CHECK (status IN ('active','inactive','churned')),
  country TEXT,
  deleted_at TIMESTAMPTZ
);
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('completed','pending','refunded')),
  total_amount NUMERIC(12,2),
  order_date DATE
);
-- Second child of users. Joining this alongside orders fans out the order rows,
-- which is what fanout_test.sql demonstrates. This comment is deliberate: it
-- also guards the parseDDL comment-stripping fix in CI.
CREATE TABLE user_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type TEXT,
  occurred_at TIMESTAMPTZ
);
