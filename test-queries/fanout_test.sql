-- PR bot verification fixture.
--
-- Fan-out aggregate: users has TWO child tables joined here (orders and
-- user_events). The second join duplicates every orders row once per matching
-- event, so SUM(o.total_amount) is inflated. Runs clean, returns wrong revenue.
--
-- Expected: AGGREGATE_OVER_FANOUT_JOIN (error), score 25.
SELECT u.country, SUM(o.total_amount) AS revenue
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN user_events e ON e.user_id = u.id
GROUP BY u.country
