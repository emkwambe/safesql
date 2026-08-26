SELECT c.plan
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id;
