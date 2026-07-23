-- WhatsApp contact phone for conversations (independent from Wispro association)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS customer_phone text;

CREATE INDEX IF NOT EXISTS conversations_customer_phone_idx
  ON conversations (customer_phone)
  WHERE customer_phone IS NOT NULL;
