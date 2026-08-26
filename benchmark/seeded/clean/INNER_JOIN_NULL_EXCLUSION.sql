SELECT p.id, c.email
FROM payments p
LEFT JOIN customers c ON c.id = p.customer_id;
