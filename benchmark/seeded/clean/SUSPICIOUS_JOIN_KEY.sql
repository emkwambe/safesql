SELECT c.id, s.plan
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id;
