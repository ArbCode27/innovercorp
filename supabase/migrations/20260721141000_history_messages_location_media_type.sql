-- Permite conservar mensajes de ubicación en historial.

ALTER TABLE public.history_messages
DROP CONSTRAINT IF EXISTS history_messages_media_type_check;

ALTER TABLE public.history_messages
ADD CONSTRAINT history_messages_media_type_check
CHECK (
  media_type IS NULL
  OR media_type IN ('audio', 'image', 'video', 'document', 'location')
);
