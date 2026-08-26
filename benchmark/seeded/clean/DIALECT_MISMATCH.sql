WITH ranked AS (
  SELECT c.id, c.plan,
         ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at, c.id) AS rn
  FROM customers c
)
SELECT id, plan FROM ranked WHERE rn = 1;
