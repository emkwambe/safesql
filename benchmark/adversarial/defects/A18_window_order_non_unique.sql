SELECT c.id, c.plan,
       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at DESC) AS rn
FROM customers c;
