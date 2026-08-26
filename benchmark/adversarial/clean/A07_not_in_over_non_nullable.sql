SELECT c.id FROM customers c
WHERE c.country NOT IN (SELECT co.code FROM countries co WHERE co.region = 'EU');
