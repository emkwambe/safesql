WITH pay AS (
  SELECT p.customer_id, SUM(p.amount) AS revenue
  FROM payments p
  WHERE p.status = 'succeeded'
  GROUP BY p.customer_id
)
SELECT c.plan, SUM(pay.revenue) AS total_revenue
FROM customers c
JOIN pay ON pay.customer_id = c.id
GROUP BY c.plan;
