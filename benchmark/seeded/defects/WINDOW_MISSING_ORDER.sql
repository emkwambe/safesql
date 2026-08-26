SELECT c.id, ROW_NUMBER() OVER () AS rn FROM customers c;
