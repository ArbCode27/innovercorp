CREATE UNIQUE INDEX IF NOT EXISTS messages_wa_message_id_unique
ON public.messages (wa_message_id)
WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_whatsapp_id_idx
ON public.clients (whatsapp_id);

CREATE INDEX IF NOT EXISTS clients_phone_idx
ON public.clients (phone);

CREATE INDEX IF NOT EXISTS conversations_client_active_idx
ON public.conversations (client_id, status, updated_at DESC);
