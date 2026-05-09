-- MODIFICAR EL TRIGGER PARA REGISTRAR LAS VENTAS DE ACOMPAÑANTES INCLUSO SI NO TIENEN STOCK LIMITADO
-- Esto asegura que aparezcan en Analíticas (Más Vendidos) y en el Reporte de Inventario.

CREATE OR REPLACE FUNCTION public.deduct_extra_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_branch_id UUID;
  v_quantity INTEGER;
  v_order_status TEXT;
  v_user_id UUID;
BEGIN
  -- 1. Obtener información de la orden y cantidad
  SELECT o.branch_id, oi.quantity, o.status, o.created_by 
  INTO v_branch_id, v_quantity, v_order_status, v_user_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = NEW.order_item_id;

  -- Solo actuar si la orden no está cancelada
  IF v_order_status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  -- 2. Intentar deducir stock si el producto tiene stock limitado
  UPDATE public.menu_items 
  SET stock = stock - v_quantity
  WHERE id = NEW.extra_id AND stock IS NOT NULL;

  -- 3. SIEMPRE registrar la transacción de venta (incluso si el producto es ilimitado/stock=NULL)
  -- Esto garantiza que aparezca en los reportes de "Más Vendidos" y Auditoría.
  INSERT INTO public.inventory_transactions (
    branch_id, 
    menu_item_id, 
    quantity_change, 
    type, 
    created_by,
    created_at
  ) VALUES (
    v_branch_id, 
    NEW.extra_id, 
    -v_quantity, 
    'Sale (Combo Complement)', 
    v_user_id,
    now()
  );

  RETURN NEW;
END;
$function$;

-- Asegurar que el trigger de restauración también sea robusto
CREATE OR REPLACE FUNCTION public.restore_extra_stock_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_item RECORD;
  v_extra RECORD;
BEGIN
  -- Solo actuar si el estado cambia a Cancelled
  IF OLD.status != 'Cancelled' AND NEW.status = 'Cancelled' THEN
    
    -- Recorrer todos los items de la orden
    FOR v_item IN SELECT id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      
      -- Por cada item, buscar sus extras que registraron venta
      FOR v_extra IN SELECT extra_id FROM public.order_item_extras WHERE order_item_id = v_item.id LOOP
        
        -- Devolver stock (solo si el producto tiene stock limitado)
        UPDATE public.menu_items 
        SET stock = stock + v_item.quantity
        WHERE id = v_extra.extra_id AND stock IS NOT NULL;
        
        -- SIEMPRE registrar el retorno/cancelación en transacciones
        INSERT INTO public.inventory_transactions (
          branch_id,
          menu_item_id,
          quantity_change,
          type,
          created_by,
          created_at
        ) VALUES (
          NEW.branch_id,
          v_extra.extra_id,
          v_item.quantity,
          'Return (Combo Complement)',
          NEW.created_by,
          now()
        );

      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
