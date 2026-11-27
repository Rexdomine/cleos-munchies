-- A hash of a random token the customer's browser keeps for its own order.
-- Re-submitting (editing) an order with the same reference requires the same token.
ALTER TABLE orders ADD COLUMN edit_token_hash TEXT NOT NULL DEFAULT '';
