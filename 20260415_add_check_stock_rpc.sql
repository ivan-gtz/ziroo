-- 20260415_add_check_stock_rpc.sql
-- RPC para chequeo ligero de inventario (Híbrido)

CREATE OR REPLACE FUNCTION public.check_stock_lightly(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_item RECORD;
    v_current_stock INTEGER;
    v_item_found BOOLEAN;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Recorre el array de productos del carrito
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_current_stock := NULL;
        v_item_found := FALSE;

        -- 1. Intentar validar como un menu_item principal
        SELECT stock INTO v_current_stock
        FROM public.menu_items
        WHERE id = (v_item.value->>'id')::uuid;

        IF FOUND THEN
            v_item_found := TRUE;
        ELSE
            -- 2. Si no es principal, intentar validar como variación
            SELECT stock INTO v_current_stock
            FROM public.menu_item_variations
            WHERE id = (v_item.value->>'id')::uuid;
            
            IF FOUND THEN
                v_item_found := TRUE;
            END IF;
        END IF;

        -- 3. Si lo encontramos y tiene stock definido (no ilimitado), comparar
        IF v_item_found AND v_current_stock IS NOT NULL THEN
            IF v_current_stock < (v_item.value->>'qty')::numeric THEN
                v_errors := array_append(v_errors, 
                    (v_item.value->>'name')::text || ' (Disp: ' || v_current_stock::text || ')'
                );
            END IF;
        END IF;
    END LOOP;

    -- Si hay errores de stock, los retornamos
    IF array_length(v_errors, 1) > 0 THEN
        RETURN jsonb_build_object('success', false, 'errors', v_errors);
    END IF;

    -- Si todo tiene stock
    RETURN jsonb_build_object('success', true);
END;
$$;
