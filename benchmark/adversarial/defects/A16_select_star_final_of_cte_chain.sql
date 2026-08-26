WITH a AS (SELECT id, amount, customer_id FROM payments),
     b AS (SELECT a.id, a.amount FROM a WHERE a.amount > 0)
SELECT * FROM b;
