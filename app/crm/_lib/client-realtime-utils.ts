import type { Client, WisproCustomer } from "./types";
import { parseWisproCustomerFromEnvoicing } from "./wispro-webhook";

/** Upsert a client row into the in-memory CRM list. */
export const upsertClientInList = (
  clients: Client[],
  incoming: Client,
): Client[] => {
  const incomingId = Number(incoming.id);
  const exists = clients.some((client) => Number(client.id) === incomingId);
  if (!exists) {
    return [...clients, incoming];
  }

  return clients.map((client) =>
    Number(client.id) === incomingId ? { ...client, ...incoming } : client,
  );
};

/**
 * Keep Wispro UI snapshot in sync with `clients.envoicing` / `wispro_id`
 * (Realtime agent link, billing refresh, etc.).
 */
export const syncWisproSnapshotFromClient = (
  current: Record<number, WisproCustomer>,
  client: Client,
): Record<number, WisproCustomer> => {
  const next = { ...current };
  const wisproId = String(client.wispro_id || "").trim();
  const clientId = Number(client.id);

  if (!wisproId) {
    delete next[clientId];
    return next;
  }

  const snapshot = parseWisproCustomerFromEnvoicing(client.envoicing);
  if (snapshot) {
    next[clientId] = snapshot;
  }

  return next;
};

export const didClientGainWisproLink = (
  previous: Client | null | undefined,
  next: Client,
): boolean => {
  const hadLink = Boolean(String(previous?.wispro_id || "").trim());
  const hasLink = Boolean(String(next.wispro_id || "").trim());
  return !hadLink && hasLink;
};
