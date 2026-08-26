SELECT c.id, d.segment
FROM customers c
JOIN customer_history d ON d.customer_id = c.id
  AND d.valid_from <= CURRENT_DATE AND d.valid_to > CURRENT_DATE;
