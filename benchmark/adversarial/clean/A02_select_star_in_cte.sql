WITH recent AS (
  SELECT * FROM payments WHERE paid_at >= DATE '2026-01-01'
)
SELECT recent.id, recent.amount FROM recent;
