-- Dense monthly calendar per plan: a date spine. Intentional CROSS JOIN.
WITH months AS (
  SELECT DATE '2026-01-01' AS month
  UNION ALL SELECT DATE '2026-02-01'
  UNION ALL SELECT DATE '2026-03-01'
), plans AS (
  SELECT DISTINCT c.plan FROM customers c
)
SELECT plans.plan, months.month
FROM plans CROSS JOIN months;
