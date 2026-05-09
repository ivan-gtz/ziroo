
-- RE-DEFINICIÓN DE place_order_secure CON NOMBRES DE COLUMNAS CORRECTOS
CREATE OR REPLACE FUNCTION public.place_order_secure(
    p_order jsonb,
    p_items jsonb[]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_order_id uuid;
    v_branch_id uuid;
    v_item jsonb;
    v_extra jsonb;
    v_order_item_id uuid;
    v_daily_ticket_number integer;
    v_result jsonb;
BEGIN
    -- 1. Extraer branch_id
    v_branch_id := (p_order->>'branch_id')::uuid;

    -- 2. Insertar la orden principal
    INSERT INTO public.orders (
        branch_id,
        table_id,
        status,
        order_type,
        customer_name,
        payment_method,
        total_amount,
        discount,
        waiter_name,
        notes,
        cash_paid,
        qr_paid,
        payment_receipt_url,
        source,
        customer_nit_ci,
        customer_complement,
        customer_doc_type,
        fiscal_number,
        fiscal_control_code,
        fiscal_base_amount,
        fiscal_debit_fiscal
    ) VALUES (
        v_branch_id,
        p_order->>'table_id',
        p_order->>'status',
        p_order->>'order_type',
        p_order->>'customer_name',
        p_order->>'payment_method',
        (p_order->>'total_amount')::numeric,
        (p_order->>'discount')::numeric,
        p_order->>'waiter_name',
        p_order->>'notes',
        (p_order->>'cash_paid')::numeric,
        (p_order->>'qr_paid')::numeric,
        p_order->>'payment_receipt_url',
        p_order->>'source',
        p_order->>'customer_nit_ci',
        p_order->>'customer_complement',
        (p_order->>'customer_doc_type')::integer,
        (p_order->>'fiscal_number')::bigint,
        p_order->>'fiscal_control_code',
        (p_order->>'fiscal_base_amount')::numeric,
        (p_order->>'fiscal_debit_fiscal')::numeric
    ) RETURNING id, daily_ticket_number INTO v_order_id, v_daily_ticket_number;

    -- 3. Insertar los items y sus extras
    FOREACH v_item IN ARRAY p_items LOOP
        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            variation_id,
            quantity,
            unit_price,
            name_snapshot
        ) VALUES (
            v_order_id,
            (v_item->>'menu_item_id')::uuid,
            (v_item->>'variation_id')::uuid,
            (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric,
            v_item->>'name_snapshot'
        ) RETURNING id INTO v_order_item_id;

        -- 4. INSERTAR EXTRAS / ACOMPAÑANTES
        IF v_item ? 'extras' AND jsonb_array_length(v_item->'extras') > 0 THEN
            FOR v_extra IN SELECT * FROM jsonb_array_elements(v_item->'extras') LOOP
                -- Usamos nombres de columnas compatibles con el frontend
                INSERT INTO public.order_item_extras (
                    order_item_id,
                    extra_id,
                    name_snapshot,
                    price_at_time
                ) VALUES (
                    v_order_item_id,
                    (v_extra->>'id')::uuid,
                    v_extra->>'name',
                    (v_extra->>'price')::numeric
                );
            END LOOP;
        END IF;
    END LOOP;

    -- 5. Preparar resultado exitoso
    SELECT jsonb_build_object(
        'success', true,
        'id', v_order_id,
        'daily_ticket_number', v_daily_ticket_number
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$function$;
