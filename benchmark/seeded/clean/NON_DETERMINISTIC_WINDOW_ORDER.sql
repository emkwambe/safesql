SELECT c.id,
       ROW_NUMBER() OVER (ORDER BY c.created_at, c.id) AS rn
FROM customers c;
