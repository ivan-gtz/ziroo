-- 20260415_prevent_recursive_combos.sql
-- Trigger para bloquear recursividad infinita en combos (Evita que un Combo sea componente de otro Combo)

CREATE OR REPLACE FUNCTION public.prevent_recursive_combos()
RETURNS TRIGGER AS $$
BEGIN
    -- Regla 1: Un item que YA ES componente de otro combo, NO puede convertirse en Combo.
    IF NEW.is_combo = true THEN
        IF EXISTS (
            SELECT 1 FROM public.menu_items 
            WHERE is_combo = true 
            AND (main_product_id = NEW.id OR NEW.id = ANY(combo_items))
            AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'Vulnerabilidad Bloqueada: Este producto ya forma parte de otro Combo. No puede convertirse en recursivo.';
        END IF;

        -- Regla 2: Un Combo NO puede tener a otro Combo declarado como componente suyo.
        IF NEW.main_product_id IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.menu_items WHERE id = NEW.main_product_id AND is_combo = true) THEN
                RAISE EXCEPTION 'Vulnerabilidad Bloqueada: El producto principal no puede ser otro Combo.';
            END IF;
        END IF;

        -- Regla 3: Un Combo NO puede tener a otros Combos en su lista de acompañamientos.
        IF array_length(NEW.combo_items, 1) > 0 THEN
            IF EXISTS (SELECT 1 FROM public.menu_items WHERE id = ANY(NEW.combo_items) AND is_combo = true) THEN
                RAISE EXCEPTION 'Vulnerabilidad Bloqueada: La lista de acompañamientos no puede contener otros Combos.';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Borrar el trigger si existía previamente
DROP TRIGGER IF EXISTS trg_prevent_recursive_combos ON public.menu_items;

-- Crear el trigger antes de INSERT o UPDATE
CREATE TRIGGER trg_prevent_recursive_combos
BEFORE INSERT OR UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.prevent_recursive_combos();
