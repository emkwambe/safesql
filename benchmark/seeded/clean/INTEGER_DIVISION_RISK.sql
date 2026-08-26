SELECT u.customer_id,
       u.queries_failed * 1.0 / NULLIF(u.queries_run, 0) AS failure_rate
FROM usage_counters u;
