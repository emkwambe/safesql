SELECT c.id, p.amount
FROM customers c
LEFT JOIN payments p ON p.customer_id = c.id AND p.status = 'succeeded';
