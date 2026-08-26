SELECT SUM(p.amount)
FROM customers c
JOIN payments p ON p.customer_id = c.id;
