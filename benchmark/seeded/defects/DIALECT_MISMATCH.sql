SELECT c.id, c.plan,
       ROW_NUMBER() OVER (PARTITION BY c.plan ORDER BY c.created_at) AS rn
FROM customers c
QUALIFY rn = 1;
