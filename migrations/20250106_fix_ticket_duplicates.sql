-- FIX: Ensure orders are always linked to an open cash register and ticket numbers sequence correctly
-- Run this in your Supabase SQL Editor

-- 1. Improved function to link orders to the active open cash register
CREATE OR REPLACE FUNCTION public.link_order_to_cash_register()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: Run as owner so anonymous/customer users can find the open register
AS $function$
DECLARE
    open_register_id uuid;
BEGIN
    -- Only attempt to link if not already linked
    IF NEW.cash_register_id IS NULL THEN
        -- Find the most recent OPEN cash register for this branch
        SELECT id INTO open_register_id
        FROM cash_registers
        WHERE branch_id = NEW.branch_id
          AND status = 'open'
        ORDER BY opening_time DESC
        LIMIT 1;

        IF open_register_id IS NOT NULL THEN
            NEW.cash_register_id := open_register_id;
        -- Optional: Raise error if no box is open?
        -- ELSE
        --    RAISE EXCEPTION 'No open cash register found. Please open a register first.';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Improved sequence logic to never reset within the same register session
CREATE OR REPLACE FUNCTION public.get_next_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    next_seq INTEGER;
BEGIN
    IF NEW.cash_register_id IS NOT NULL THEN
        -- Increment based on this specific register's history
        SELECT COALESCE(MAX(daily_ticket_number), 0) + 1
        INTO next_seq
        FROM orders
        WHERE cash_register_id = NEW.cash_register_id;
    ELSE
        -- Fallback: If no register found (orphan), sequence by date/branch to avoid duplicates
        SELECT COALESCE(MAX(daily_ticket_number), 0) + 1
        INTO next_seq
        FROM orders
        WHERE branch_id = NEW.branch_id
          AND cash_register_id IS NULL
          AND DATE(created_at AT TIME ZONE 'UTC') = DATE(NEW.created_at AT TIME ZONE 'UTC');
    END IF;

    NEW.daily_ticket_number := next_seq;
    RETURN NEW;
END;
$function$;
