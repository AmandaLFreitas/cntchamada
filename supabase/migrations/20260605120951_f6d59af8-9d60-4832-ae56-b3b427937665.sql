
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
    'cris@cnt.com', crypt('Cris@2026', gen_salt('bf')),
    now(), now(), now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', 'cris@cnt.com'), 'email', new_user_id::text, now(), now(), now());

  INSERT INTO public.user_roles (user_id, role, display_name) VALUES (new_user_id, 'admin', 'Cris');

  INSERT INTO public.user_schools (user_id, school_id)
  VALUES
    (new_user_id, '6d1e797a-4997-48d3-8b03-525d8c5eb225'),
    (new_user_id, 'f26d3ddc-a87e-4266-97e0-717d9bd0a2b2');
END $$;
