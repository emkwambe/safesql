-- Corrected: pre-aggregate payments to one row per customer before joining.
WITH pay AS (
  SELECT p.customer_id, DATE_TRUNC('month', p.paid_at) AS month,
         SUM(p.amount) AS revenue
  FROM payments p
  WHERE p.status = 'succeeded' AND p.paid_at >= '2026-01-01'
  GROUP BY p.customer_id, DATE_TRUNC('month', p.paid_at)
)
SELECT c.plan, pay.month, SUM(pay.revenue) AS total_revenue
FROM customers c
JOIN pay ON pay.customer_id = c.id
GROUP BY c.plan, pay.month;
