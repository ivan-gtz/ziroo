
-- 1. MEJORAR DEDUCCIÓN DE STOCK PARA EXTRAS (ACOMPAÑANTES DE COMBO Y EXTRAS)
-- Esta función se asegura de que si un "extra" es en realidad un producto del menú, se descuente su stock.
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

  -- 2. Deducir stock si el extra corresponde a un producto en menu_items
  UPDATE public.menu_items 
  SET stock = stock - v_quantity
  WHERE id = NEW.extra_id AND stock IS NOT NULL;

  -- 3. Si se afectó el stock de un menu_item, registrar la transacción para analíticas (Best Sellers)
  IF FOUND THEN
    INSERT INTO public.inventory_transactions (
      branch_id,
      menu_item_id,
      quantity_change,
      type,
      created_by
    ) VALUES (
      v_branch_id,
      NEW.extra_id,
      -v_quantity,
      'Sale (Companion/Extra)',
      v_user_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Asegurar que el trigger está activo
DROP TRIGGER IF EXISTS tr_deduct_extra_stock ON public.order_item_extras;
CREATE TRIGGER tr_deduct_extra_stock
AFTER INSERT ON public.order_item_extras
FOR EACH ROW EXECUTE FUNCTION public.deduct_extra_stock();


-- 2. ASEGURAR QUE LOS EXTRAS SE DEVUELVEN AL CANCELAR
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
      
      -- Por cada item, buscar sus extras que descontaron stock
      FOR v_extra IN SELECT extra_id FROM public.order_item_extras WHERE order_item_id = v_item.id LOOP
        
        -- Devolver stock al producto
        UPDATE public.menu_items 
        SET stock = stock + v_item.quantity
        WHERE id = v_extra.extra_id AND stock IS NOT NULL;
        
        -- Registrar la devolución en transacciones
        IF FOUND THEN
           INSERT INTO public.inventory_transactions (
            branch_id,
            menu_item_id,
            quantity_change,
            type,
            created_by
          ) VALUES (
            NEW.branch_id,
            v_extra.extra_id,
            v_item.quantity,
            'Return (Cancellation)',
            NEW.created_by
          );
        END IF;

      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_restore_extra_stock_on_cancel ON public.orders;
CREATE TRIGGER tr_restore_extra_stock_on_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_extra_stock_on_cancel();
