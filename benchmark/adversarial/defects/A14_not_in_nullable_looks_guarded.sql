SELECT c.id FROM customers c
WHERE c.id NOT IN (
  SELECT p.customer_id FROM payments p WHERE p.status = 'succeeded'
);
