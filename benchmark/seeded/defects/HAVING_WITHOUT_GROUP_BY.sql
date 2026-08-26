SELECT SUM(p.amount) AS total FROM payments p HAVING SUM(p.amount) > 1000;
