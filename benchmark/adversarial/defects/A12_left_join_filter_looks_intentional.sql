-- Keep every customer, including those with no successful payment.
SELECT c.id, p.amount
FROM customers c
LEFT JOIN payments p ON p.customer_id = c.id
WHERE p.status = 'succeeded';
