SELECT c.id,
       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at, c.id) AS rn
FROM customers c;
