-- Deliberately excludes orphaned payments: unattributed revenue is
-- reported separately and must not appear here.
SELECT p.id, p.amount, c.email
FROM payments p
JOIN customers c ON c.id = p.customer_id
WHERE p.status = 'succeeded';
