WITH joined AS (
  SELECT c.plan, p.amount
  FROM customers c
  JOIN subscriptions s ON s.customer_id = c.id
  JOIN payments p ON p.customer_id = c.id
)
SELECT joined.plan, SUM(joined.amount) AS total FROM joined GROUP BY joined.plan;
