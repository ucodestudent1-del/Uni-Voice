-- ============================================================================
-- Phase 29: Performance indexes for quote item/fee loading and receipt PDF queries.
-- ============================================================================

-- Quote items: composite index for findById JSON subquery (ORDER BY sort_order, created_at)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_sort
  ON quote_items(quote_id, sort_order, created_at);

-- Quote fees: composite index for findById JSON subquery (ORDER BY sort_order, created_at)
CREATE INDEX IF NOT EXISTS idx_quote_fees_quote_sort
  ON quote_fees(quote_id, sort_order, created_at);
