SELECT cust.email, sub.plan
FROM customers cust
JOIN subscriptions sub ON cust.id = sub.id
WHERE sub.status = 'active';
