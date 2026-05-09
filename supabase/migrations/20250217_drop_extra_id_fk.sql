-- Drop the foreign key constraint that limits extra_id to only exist in product_extras
-- This is necessary because for combo meals, we are now including menu_item IDs in the extras array
-- to handle stock deduction for accompaniments and main dishes.

ALTER TABLE public.order_item_extras 
DROP CONSTRAINT IF EXISTS order_item_extras_extra_id_fkey;

-- We don't necessarily need a new FK because this column can now refer to either product_extras OR menu_items.
-- The deduction logic is handled by the triggers created in 20250217_fix_combo_extras_stock.sql
