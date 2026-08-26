SELECT c.plan, c.country, SUM(s.amount) AS total
FROM subscriptions s
JOIN customers c ON c.id = s.customer_id
GROUP BY c.plan;
