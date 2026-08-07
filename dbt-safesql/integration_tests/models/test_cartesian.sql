-- Cartesian product. The join to orders has no ON (or USING) clause, so every
-- user row pairs with every order row. Expected detector: CARTESIAN_JOIN
-- (hard error, score 25).
--
-- Note: this is deliberately not runnable SQL — Postgres rejects an INNER JOIN
-- without ON. It exists to exercise the detector, not to be built by dbt.
SELECT
  u.id AS user_id,
  u.country,
  o.total_amount
FROM {{ ref('users') }} u
JOIN {{ ref('orders') }} o
