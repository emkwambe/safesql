-- Monthly revenue by plan - for the board deck
-- Looks right. Ran without errors. Numbers are wrong by 3-10x.
SELECT
  c.plan,
  DATE_TRUNC('month', p.paid_at) AS month,
  SUM(p.amount) AS total_revenue,
  COUNT(DISTINCT c.id) AS paying_customers
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id
JOIN payments p ON p.customer_id = c.id
WHERE p.status = 'succeeded'
  AND p.paid_at >= '2026-01-01'
GROUP BY c.plan, DATE_TRUNC('month', p.paid_at)
ORDER BY DATE_TRUNC('month', p.paid_at) DESC, total_revenue DESC;
