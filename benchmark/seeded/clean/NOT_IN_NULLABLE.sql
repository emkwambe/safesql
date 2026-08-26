SELECT c.id
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.customer_id = c.id);
