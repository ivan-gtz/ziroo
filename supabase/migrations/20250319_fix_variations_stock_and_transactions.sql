
-- FIX 1: ACTUALIZAR EL TRIGGER DE EXTRAS PARA MANEJAR VARIACIONES
-- Esta función se asegura de que si un "extra" de combo es una variación de producto, se descuente su stock correctamente.
-- Además, registra la transacción con el variation_id para que aparezca en el reporte de inventario.

CREATE OR REPLACE FUNCTION public.deduct_extra_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_branch_id UUID;
  v_order_status TEXT;
  v_quantity INTEGER;
  v_order_id UUID;
  v_user_id UUID;
  v_menu_item_id UUID;
  v_variation_id UUID;
BEGIN
  -- 1. Obtener la orden y el branch_id
  SELECT oi.order_id, o.branch_id, o.status, oi.quantity, o.created_by
  INTO v_order_id, v_branch_id, v_order_status, v_quantity, v_user_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = NEW.order_item_id;

  -- Solo deducir si la orden no está cancelada
  IF v_order_status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  -- 2. Identificar si es un producto base o una variación
  -- Intentar actualizar como variación primero
  UPDATE public.menu_item_variations
  SET stock = stock - v_quantity
  WHERE id = NEW.extra_id AND stock IS NOT NULL
  RETURNING menu_item_id INTO v_menu_item_id;

  IF FOUND THEN
    v_variation_id := NEW.extra_id;
  ELSE
    -- Si no se encontró como variación, intentar como producto base
    UPDATE public.menu_items 
    SET stock = stock - v_quantity
    WHERE id = NEW.extra_id AND stock IS NOT NULL;
    
    IF FOUND THEN
      v_menu_item_id := NEW.extra_id;
      v_variation_id := NULL;
    END IF;
  END IF;

  -- 3. SIEMPRE registrar la transacción (incluso si el producto es ilimitado/stock=NULL)
  -- Esto garantiza que aparezca en los reportes de "Más Vendidos" e "Inventario Diario".
  -- Si el extra no se encontró en menu_items o variations, usamos el extra_id como menu_item_id (fallback)
  IF v_menu_item_id IS NULL THEN
     v_menu_item_id := NEW.extra_id;
  END IF;

  INSERT INTO public.inventory_transactions (
    branch_id,
    menu_item_id,
    variation_id,
    quantity_change,
    type,
    created_by,
    created_at
  ) VALUES (
    v_branch_id,
    v_menu_item_id,
    v_variation_id,
    -v_quantity,
    'Sale (Combo Component)',
    v_user_id,
    now()
  );

  RETURN NEW;
END;
$function$;

-- FIX 2: ACTUALIZAR EL TRIGGER DE RESTAURACIÓN PARA MANEJAR VARIACIONES
CREATE OR REPLACE FUNCTION public.restore_extra_stock_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_item RECORD;
  v_extra RECORD;
  v_menu_item_id UUID;
  v_variation_id UUID;
BEGIN
  -- Solo actuar si el estado cambia a Cancelled
  IF OLD.status != 'Cancelled' AND NEW.status = 'Cancelled' THEN
    
    -- Recorrer todos los items de la orden
    FOR v_item IN SELECT id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      
      -- Por cada item, buscar sus extras
      FOR v_extra IN SELECT extra_id FROM public.order_item_extras WHERE order_item_id = v_item.id LOOP
        
        v_menu_item_id := NULL;
        v_variation_id := NULL;

        -- Intentar devolver stock a la variación
        UPDATE public.menu_item_variations
        SET stock = stock + v_item.quantity
        WHERE id = v_extra.extra_id AND stock IS NOT NULL
        RETURNING menu_item_id INTO v_menu_item_id;

        IF v_menu_item_id IS NOT NULL THEN
           v_variation_id := v_extra.extra_id;
        ELSE
          -- Si no es variación, intentar como producto base
          UPDATE public.menu_items 
          SET stock = stock + v_item.quantity
          WHERE id = v_extra.extra_id AND stock IS NOT NULL;
          
          IF FOUND THEN
            v_menu_item_id := v_extra.extra_id;
          END IF;
        END IF;

        -- SIEMPRE registrar el retorno en transacciones
        INSERT INTO public.inventory_transactions (
          branch_id,
          menu_item_id,
          variation_id,
          quantity_change,
          type,
          created_by,
          created_at
        ) VALUES (
          NEW.branch_id,
          COALESCE(v_menu_item_id, v_extra.extra_id),
          v_variation_id,
          v_item.quantity,
          'Return (Combo Component)',
          NEW.created_by,
          now()
        );

      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
