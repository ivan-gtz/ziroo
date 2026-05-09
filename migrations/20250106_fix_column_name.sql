-- FIX: Correct column name in link_order_to_cash_register function
-- "opening_time" does not exist, it should be "opened_at"

CREATE OR REPLACE FUNCTION public.link_order_to_cash_register()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    open_register_id uuid;
BEGIN
    IF NEW.cash_register_id IS NULL THEN
        -- Find the most recent OPEN cash register for this branch
        SELECT id INTO open_register_id
        FROM cash_registers
        WHERE branch_id = NEW.branch_id
          AND status = 'open'
        ORDER BY opened_at DESC -- CORRECTED COLUMN NAME
        LIMIT 1;

        IF open_register_id IS NOT NULL THEN
            NEW.cash_register_id := open_register_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
