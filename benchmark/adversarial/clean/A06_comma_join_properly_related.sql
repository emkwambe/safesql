SELECT c.id, p.amount
FROM customers c, payments p
WHERE p.customer_id = c.id AND p.status = 'succeeded';
