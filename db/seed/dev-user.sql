-- Create dev demo user: auth.users -> profiles -> org_members
DO $$
DECLARE
  v_user_id UUID;
  v_org_id  UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'grupo-lauxen';

  -- 1) auth.users
  INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
  VALUES ('admin@moneymind.app', 'dev-only', '{"name":"Everton Lauxen"}')
  ON CONFLICT (email) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data
  RETURNING id INTO v_user_id;

  -- 2) profiles (FK from auth.users)
  INSERT INTO profiles (id, name, email)
  VALUES (v_user_id, 'Everton Lauxen', 'admin@moneymind.app')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- 3) org_members
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  -- 4) org owner (column may not exist in all schemas)
  BEGIN
    EXECUTE 'UPDATE organizations SET owner_id = $1 WHERE id = $2' USING v_user_id, v_org_id;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- 5) subscription
  INSERT INTO subscriptions (org_id, plan, status, trial_end)
  VALUES (v_org_id, 'business', 'active', NOW() + INTERVAL '365 days')
  ON CONFLICT (org_id) DO NOTHING;

  RAISE NOTICE 'Dev user: % | Org: %', v_user_id, v_org_id;
END $$;
