SELECT u.customer_id, u.queries_failed / u.queries_run AS failure_rate
FROM usage_counters u;
