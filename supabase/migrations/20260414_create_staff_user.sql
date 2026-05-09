CREATE OR REPLACE FUNCTION public.create_staff_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_restaurant_id UUID,
  p_branch_id UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Auth check: Only SuperAdmin or Admin can execute
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'SuperAdmin') OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'Admin' AND restaurant_id = p_restaurant_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  p_email := lower(trim(p_email));

  -- Check if exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El usuario ya existe');
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert into auth.users (Must grant privileges or run as superuser. SECURITY DEFINER helps here)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email, v_encrypted_password,
    now(), now(), now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', p_full_name), 
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text, 
    jsonb_build_object('sub', v_user_id::text, 'email', p_email), 
    'email', now(), now(), now()
  );

  -- user_profiles is handled manually or via trigger. If via trigger, it might fail/duplicate if we do it here.
  -- But we need to ensure role, restaurant_id and branch_id are set.
  -- We'll try to upsert to be safe.
  INSERT INTO public.user_profiles (id, email, full_name, role, restaurant_id, branch_id)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_restaurant_id, p_branch_id)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role, 
      restaurant_id = EXCLUDED.restaurant_id, 
      branch_id = EXCLUDED.branch_id,
      full_name = EXCLUDED.full_name;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Give access to authenticated users
GRANT EXECUTE ON FUNCTION public.create_staff_user TO authenticated;
