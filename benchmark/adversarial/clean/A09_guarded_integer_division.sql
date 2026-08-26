SELECT u.customer_id,
       CAST(u.queries_failed AS NUMERIC) / NULLIF(u.queries_run, 0) AS failure_rate
FROM usage_counters u;
