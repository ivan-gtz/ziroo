-- =========================================================================
-- Ziroo SQL Migration: Eliminación Segura de Sucursales
-- Fecha: 2026-04-14
-- =========================================================================

-- Esta función elimina una sucursal y todos sus usuarios subordinados 
-- (meseros, cajeros) en una transacción segura, previniendo que la UI crashee.
CREATE OR REPLACE FUNCTION public.delete_branch_safely(
    p_branch_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Eliminar los perfiles de usuario que pertenecen a esta sucursal.
    -- Esto los deja sin privilegios para ingresar al sistema (Inactivos/Fantasmas).
    DELETE FROM public.user_profiles WHERE branch_id = p_branch_id;
    
    -- 2. Eliminar la sucursal. 
    -- Gracias a ON DELETE CASCADE en las tablas hijas, las ordenes, inventario, etc., desaparecen solos.
    DELETE FROM public.branches WHERE id = p_branch_id;
END;
$$;
