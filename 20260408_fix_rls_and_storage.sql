-- SCRIPT PARA SOLUCIONAR ERRORES DE RLS, STORAGE Y ON CONFLICT

-- ==========================================
-- 1. Políticas RLS para 'monthly_summaries'
-- ==========================================
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_summaries_all_policy" ON monthly_summaries;
CREATE POLICY "monthly_summaries_all_policy" 
ON monthly_summaries 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 2. Políticas RLS para 'printer_config'
-- ==========================================
ALTER TABLE printer_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "printer_config_all_policy" ON printer_config;
CREATE POLICY "printer_config_all_policy" 
ON printer_config 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 3. Políticas RLS para 'restaurant_settings'
-- ==========================================
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "restaurant_settings_all_policy" ON restaurant_settings;
CREATE POLICY "restaurant_settings_all_policy" 
ON restaurant_settings 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- 4. Storage Bucket 'branding'
-- ==========================================
-- Aseguramos que el bucket exista
INSERT INTO storage.buckets (id, name, public) 
VALUES ('branding', 'branding', true) 
ON CONFLICT (id) DO NOTHING;

-- Borramos políticas anteriores si existen
DROP POLICY IF EXISTS "branding_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "branding_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "branding_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "branding_select_policy" ON storage.objects;

-- Lectura Pública
CREATE POLICY "branding_select_policy"
ON storage.objects FOR SELECT
USING ( bucket_id = 'branding' );

-- Inserción (Usuarios Autenticados)
CREATE POLICY "branding_upload_policy"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'branding' AND auth.role() = 'authenticated' );

-- Actualización (Usuarios Autenticados)
CREATE POLICY "branding_update_policy"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'branding' AND auth.role() = 'authenticated' );

-- Borrado (Usuarios Autenticados)
CREATE POLICY "branding_delete_policy"
ON storage.objects FOR DELETE
USING ( bucket_id = 'branding' AND auth.role() = 'authenticated' );
