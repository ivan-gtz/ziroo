-- =========================================================================
-- Ziroo SQL Migration: Optimizacion de Calculo de Estadisticas en Sucursales
-- Fecha: 2026-04-14
-- =========================================================================

-- Esta función agrupa las sumatorias a nivel del motor PostgreSQL Edge Compute
-- en lugar de depender del Frontend del usuario, resolviendo la fuga de memoria.
CREATE OR REPLACE FUNCTION public.get_branch_daily_stats_v2(
    p_branch_id UUID,
    p_target_date DATE,
    p_timezone TEXT
)
RETURNS TABLE (
    sales_today NUMERIC(12,2),
    orders_today BIGINT,
    online_orders BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(total_amount), 0)::NUMERIC(12,2) AS sales_today,
        COUNT(*)::BIGINT AS orders_today,
        COUNT(*) FILTER (WHERE source = 'online' OR waiter_name = 'Customer App' OR source = 'CustomerMenu')::BIGINT AS online_orders
    FROM orders
    WHERE branch_id = p_branch_id
    AND status = 'Delivered'
    -- Convertimos el timestamp UTC puro al timezone físico de la sucursal antes de compararlo con el dia contable meta
    AND (created_at AT TIME ZONE COALESCE(p_timezone, 'America/La_Paz'))::date = p_target_date;
END;
$$;
