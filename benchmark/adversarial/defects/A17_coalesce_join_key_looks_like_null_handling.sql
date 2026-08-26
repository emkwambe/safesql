SELECT c.id, p.amount
FROM customers c
JOIN payments p ON COALESCE(p.customer_id, p.subscription_id) = c.id;
