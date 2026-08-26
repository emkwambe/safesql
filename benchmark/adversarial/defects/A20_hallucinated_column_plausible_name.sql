SELECT c.id, c.email, c.churn_risk_score
FROM customers c
WHERE c.plan = 'business';
