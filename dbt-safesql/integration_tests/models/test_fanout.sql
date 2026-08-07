-- Fan-out aggregate. Runs clean, returns inflated revenue.
--
-- users joins orders (1:N) AND user_tags (1:N). The second join multiplies
-- every order row by the number of tags on that user, so SUM(o.total_amount)
-- over-counts. Expected detector: AGGREGATE_OVER_FANOUT_JOIN.
SELECT
  u.country,
  SUM(o.total_amount) AS revenue
FROM {{ ref('users') }} u
JOIN {{ ref('orders') }} o ON o.user_id = u.id
JOIN {{ ref('user_tags') }} t ON t.user_id = u.id
GROUP BY u.country
