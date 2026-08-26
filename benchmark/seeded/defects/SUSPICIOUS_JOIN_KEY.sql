SELECT c.id, s.plan
FROM customers c
JOIN subscriptions s ON c.id = s.id;
