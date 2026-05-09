-- FIX: Remove invalid column reference "source" from rate limit function
-- logic: Apply rate limit only to anonymous users (customers)

CREATE OR REPLACE FUNCTION public.check_order_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    recent_order_count INTEGER;
    current_user_role text;
BEGIN
    -- Get the current user's role (anon, authenticated, service_role)
    -- We use exception handling just in case auth.role() is not available (e.g. internal calls)
    BEGIN
        SELECT auth.role() INTO current_user_role;
    EXCEPTION WHEN OTHERS THEN
        current_user_role := 'unknown';
    END;

    -- Apply limits ONLY to anonymous users (Customer Menu / QR)
    IF current_user_role = 'anon' THEN
         -- Count recent pending orders for this specific customer/table context
         SELECT COUNT(*) INTO recent_order_count
         FROM orders
         WHERE branch_id = NEW.branch_id
           AND created_at > (NOW() - INTERVAL '1 minute')
           AND status NOT IN ('Cancelled', 'Rejected') -- Ignore rejected ones? No, spam is spam.
           AND (
               -- If multiple people are at Table 5, we might limit Table 5 globally? 
               -- Or try to use customer_name if provided.
               -- For safety, limiting by Name + Branch is decent for anon.
               (NEW.customer_name IS NOT NULL AND customer_name = NEW.customer_name)
           );

         -- Allow max 2 orders per minute per "identity"
         IF recent_order_count >= 2 THEN
             RAISE EXCEPTION 'Por favor espera un momento antes de realizar otro pedido.';
         END IF;
    END IF;

    RETURN NEW;
END;
$function$;
