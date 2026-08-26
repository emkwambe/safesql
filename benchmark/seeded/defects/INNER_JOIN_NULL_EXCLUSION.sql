SELECT p.id, c.email
FROM payments p
JOIN customers c ON c.id = p.customer_id;
