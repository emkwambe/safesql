SELECT c.id, d.segment
FROM customers c
JOIN customer_history d ON d.customer_id = c.id;
