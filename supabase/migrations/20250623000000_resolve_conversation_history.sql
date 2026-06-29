-- Archiva una conversación en conversation_history, elimina mensajes y la conversación activa.
-- Ejecutar en Supabase SQL Editor si no usas CLI de migraciones.

CREATE OR REPLACE FUNCTION public.resolve_conversation(
  p_conversation_id bigint,
  p_resolved_by bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_client_name text;
  v_client_phone text;
  v_client_plan text;
  v_client_zone text;
  v_client_account text;
  v_messages jsonb;
  v_total int;
  v_first timestamptz;
  v_last timestamptz;
  v_history_id bigint;
BEGIN
  SELECT * INTO v_conv
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversación no encontrada: %', p_conversation_id;
  END IF;

  v_client_name := NULL;
  v_client_phone := NULL;
  v_client_plan := NULL;
  v_client_zone := NULL;
  v_client_account := NULL;

  IF v_conv.client_id IS NOT NULL THEN
    SELECT c.name, c.phone, c.plan, c.zone, c.account
    INTO v_client_name, v_client_phone, v_client_plan, v_client_zone, v_client_account
    FROM clients c
    WHERE c.id = v_conv.client_id;
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'type', m.type,
          'content', m.content,
          'sender_type', m.sender_type,
          'media_url', m.media_url,
          'media_type', m.media_type,
          'wa_message_id', m.wa_message_id,
          'status', m.status,
          'created_at', m.created_at
        )
        ORDER BY m.created_at
      ),
      '[]'::jsonb
    ),
    COUNT(*)::int,
    MIN(m.created_at),
    MAX(m.created_at)
  INTO v_messages, v_total, v_first, v_last
  FROM messages m
  WHERE m.conversation_id = p_conversation_id;

  INSERT INTO conversation_history (
    conversation_id,
    client_id,
    agent_id,
    client_name,
    client_phone,
    client_plan,
    client_zone,
    client_account,
    resolved_at,
    resolved_by,
    human_mode,
    label_ids,
    wa_phone_number_id,
    total_messages,
    first_message_at,
    last_message_at,
    summary,
    messages_snapshot
  ) VALUES (
    v_conv.id,
    v_conv.client_id,
    v_conv.agent_id,
    v_client_name,
    v_client_phone,
    v_client_plan,
    v_client_zone,
    v_client_account,
    now(),
    p_resolved_by,
    COALESCE(v_conv.human_mode, false),
    COALESCE(v_conv.label_ids, ARRAY[]::bigint[]),
    v_conv.wa_phone_number_id,
    COALESCE(v_total, 0),
    v_first,
    v_last,
    v_conv.preview,
    v_messages
  )
  RETURNING id INTO v_history_id;

  DELETE FROM messages WHERE conversation_id = p_conversation_id;
  DELETE FROM conversations WHERE id = p_conversation_id;

  RETURN v_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_conversation(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_conversation(bigint, bigint) TO service_role;
