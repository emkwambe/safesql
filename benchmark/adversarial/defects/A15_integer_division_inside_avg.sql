SELECT AVG(u.queries_failed / u.queries_run) AS avg_failure_rate
FROM usage_counters u;
