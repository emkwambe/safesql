SELECT c.plan, COUNT(*) AS customer_count
FROM customers c
JOIN payments p ON p.customer_id = c.id
GROUP BY c.plan;
