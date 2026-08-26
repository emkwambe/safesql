SELECT e.id
FROM events e
WHERE e.occurred_at >= TIMESTAMP '2026-01-01 00:00:00';
