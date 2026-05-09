-- 20260416_add_set_inventory_stock_rpc.sql
-- RPC para setear el stock de inventario de forma absoluta pero calculando el delta para logs de auditoría

CREATE OR REPLACE FUNCTION public.set_inventory_stock_secure(p_item_id uuid, p_variation_id uuid, p_new_stock integer, p_branch_id uuid, p_user_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_old_stock INTEGER;
    v_delta INTEGER;
BEGIN
    -- 1. Obtener y Bloquear la Fila para evitar Race Conditions
    IF p_variation_id IS NOT NULL THEN
        SELECT stock INTO v_old_stock FROM public.menu_item_variations WHERE id = p_variation_id FOR UPDATE;
    ELSE
        SELECT stock INTO v_old_stock FROM public.menu_items WHERE id = p_item_id FOR UPDATE;
    END IF;

    -- 2. Calcular la Diferencia Real (Delta)
    IF v_old_stock IS NULL AND p_new_stock IS NOT NULL THEN
        v_delta := p_new_stock; -- De ilimitado a un valor específico
    ELSIF v_old_stock IS NOT NULL AND p_new_stock IS NULL THEN
        v_delta := -v_old_stock; -- De un valor específico a ilimitado
    ELSIF v_old_stock IS NULL AND p_new_stock IS NULL THEN
        v_delta := 0; -- Sin cambios reales
    ELSE
        v_delta := p_new_stock - v_old_stock;
    END IF;

    -- 3. Registrar Transacción en Auditoría (sólo si de verdad hubo modulación)
    -- Tipo 'Adjustment' sirve para indicar que fue una sobre-escritura manual
    INSERT INTO public.inventory_transactions (
        branch_id, menu_item_id, variation_id, quantity_change, type, created_by
    ) VALUES (
        p_branch_id, p_item_id, p_variation_id, v_delta, 'Adjustment', COALESCE(p_user_id, auth.uid())
    );

    -- 4. Actualizar el Stock al número absoluto nuevo
    IF p_variation_id IS NOT NULL THEN
        UPDATE public.menu_item_variations 
        SET stock = p_new_stock
        WHERE id = p_variation_id;
    ELSE
        UPDATE public.menu_items 
        SET stock = p_new_stock
        WHERE id = p_item_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'new_stock', p_new_stock, 'delta_applied', v_delta);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
