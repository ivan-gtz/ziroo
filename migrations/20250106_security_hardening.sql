-- SECURITY HARDENING & RATE LIMITING MIGRATION
-- Run this in Supabase SQL Editor

-- 1. SECURE FUNCTIONS (Fix 'search_path' vulnerability)
-- This prevents malicious code from hijacking common names if someone manages to create objects in the public schema.
-- We explicitly set the search_path to 'public' for all SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION public.link_order_to_cash_register()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- FIX: Secure search path
AS $function$
DECLARE
    open_register_id uuid;
BEGIN
    IF NEW.cash_register_id IS NULL THEN
        SELECT id INTO open_register_id
        FROM cash_registers
        WHERE branch_id = NEW.branch_id
          AND status = 'open'
        ORDER BY opening_time DESC
        LIMIT 1;

        IF open_register_id IS NOT NULL THEN
            NEW.cash_register_id := open_register_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_next_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- FIX: Secure search path
AS $function$
DECLARE
    next_seq INTEGER;
BEGIN
    IF NEW.cash_register_id IS NOT NULL THEN
        SELECT COALESCE(MAX(daily_ticket_number), 0) + 1
        INTO next_seq
        FROM orders
        WHERE cash_register_id = NEW.cash_register_id;
    ELSE
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


-- 2. RATE LIMITING (Anti-Spam without Captcha)
-- We'll use a trigger to check how many "Pending" or "AwaitingApproval" orders
-- have been created from the same IP/Source recently.
-- NOTE: Since we don't always fully track IP in DB fields by default in this schema, 
-- we will limit based on 'customer_name' duplication time or simple volume per minute per branch for anonymous orders.
-- Ideally, we'd log client IP, but Supabase Edge Functions handling logic is better for IP banning.
-- HERE, we will add a simpler logic: Prevent > 5 orders in 1 minute from the "same context" implies spam.
-- Actually, a better approach for "Menu Cliente" is to ensure they can't spam faster than humanly possible.

CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    recent_order_count INTEGER;
BEGIN
    -- Only check for anonymous/customer orders (usually those awaiting approval or pending without a creator user link if that logic exists, 
    -- but here we'll assume source='CustomerMenu' or checking created_by if it's null/anon)
    
    -- Heuristic: If 3+ orders exist for this SAME TABLE (or same name if takeaway) in the last 2 minutes that are still pending/approval, reject.
    -- This prevents a single user from mashing the "Order" button or script spamming a single table.
    
    IF NEW.source = 'CustomerMenu' OR NEW.source = 'QR' THEN
         SELECT COUNT(*) INTO recent_order_count
         FROM orders
         WHERE branch_id = NEW.branch_id
           AND created_at > (NOW() - INTERVAL '1 minute')
           -- If table_id is present, limit per table. If takeaway, limit per customer name roughly?
           -- It's hard to identifying unique anonymous users without IP.
           -- Limiting purely by Table/Branch is safest to avoid annoying legitimate users.
           AND (
               (NEW.table_id IS NOT NULL AND table_id = NEW.table_id) OR
               (NEW.table_id IS NULL AND customer_name = NEW.customer_name)
           );

         -- Allow max 2 orders per minute per table/customer
         IF recent_order_count >= 2 THEN
             RAISE EXCEPTION 'Por favor espera un momento antes de realizar otro pedido.';
         END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Register the rate limit trigger
DROP TRIGGER IF EXISTS tr_rate_limit_orders ON orders;
CREATE TRIGGER tr_rate_limit_orders
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_order_rate_limit();

