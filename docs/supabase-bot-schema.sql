-- Bot API Keys table
CREATE TABLE IF NOT EXISTS public.bot_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  key_hash text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS bot_api_keys_user_idx ON public.bot_api_keys (user_id);
CREATE INDEX IF NOT EXISTS bot_api_keys_key_hash_idx ON public.bot_api_keys (key_hash);

ALTER TABLE public.bot_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_api_keys_own" ON public.bot_api_keys FOR ALL TO authenticated USING (user_id = auth.uid());

-- Function to verify bot API key
CREATE OR REPLACE FUNCTION verify_bot_api_key(p_key_hash text)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.bot_api_keys
  WHERE key_hash = p_key_hash
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Update last_used_at
  UPDATE public.bot_api_keys
  SET last_used_at = NOW()
  WHERE key_hash = p_key_hash;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create bot API key
CREATE OR REPLACE FUNCTION create_bot_api_key(p_user_id uuid, p_name text DEFAULT 'Default')
RETURNS text AS $$
DECLARE
  v_key text;
  v_key_hash text;
BEGIN
  -- Generate random key
  v_key := 'ltrain_' || encode(gen_random_bytes(24), 'base64url');
  v_key_hash := encode(sha256(v_key::bytea), 'hex');
  
  INSERT INTO public.bot_api_keys (user_id, name, key_hash)
  VALUES (p_user_id, p_name, v_key_hash);
  
  RETURN v_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
