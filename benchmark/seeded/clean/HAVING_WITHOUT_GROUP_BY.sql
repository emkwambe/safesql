SELECT p.customer_id, SUM(p.amount) AS total
FROM payments p
GROUP BY p.customer_id
HAVING SUM(p.amount) > 1000;
