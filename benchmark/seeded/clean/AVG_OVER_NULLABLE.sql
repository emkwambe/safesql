SELECT AVG(COALESCE(s.amount, 0)) AS avg_amount FROM subscriptions s;
