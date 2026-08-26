SELECT c.id,
       ROW_NUMBER() OVER (ORDER BY c.created_at) AS rn
FROM customers c;
