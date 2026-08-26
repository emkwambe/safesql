WITH s AS (
  SELECT customer_id, SUM(amount) AS subs FROM subscriptions GROUP BY customer_id
), p AS (
  SELECT customer_id, SUM(amount) AS pays FROM payments GROUP BY customer_id
)
SELECT c.id, s.subs, p.pays
FROM customers c
JOIN s ON s.customer_id = c.id
JOIN p ON p.customer_id = c.id;
