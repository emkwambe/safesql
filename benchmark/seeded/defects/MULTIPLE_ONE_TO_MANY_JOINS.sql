SELECT c.id, s.plan, p.amount
FROM customers c
JOIN subscriptions s ON s.customer_id = c.id
JOIN payments p ON p.customer_id = c.id;
