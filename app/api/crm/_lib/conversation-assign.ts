import type { SupabaseClient } from "@supabase/supabase-js";

const LOG_PREFIX = "[CRM_ASSIGN]";

/**
 * Assigns a conversation to an advisor (human mode). Soft-fails on errors.
 * Reopens resolved chats so they appear in "Mis conversaciones".
 */
export const assignConversationToAgent = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    agentId: number;
  },
): Promise<{
  assigned: boolean;
  agentName: string | null;
  conversationId: number;
}> => {
  const conversationId = input.conversationId;
  const agentId = input.agentId;

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError || !agent) {
    console.warn(`${LOG_PREFIX} agent_not_found`, {
      conversationId,
      agentId,
      error: agentError?.message || "not_found",
    });
    return { assigned: false, agentName: null, conversationId };
  }

  const agentName = String(agent.name || "").trim() || `Asesor #${agentId}`;
  const now = new Date().toISOString();

  const { data: conversation, error: readError } = await supabase
    .from("conversations")
    .select("id, status, agent_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError || !conversation) {
    console.warn(`${LOG_PREFIX} conversation_not_found`, {
      conversationId,
      agentId,
      error: readError?.message || "not_found",
    });
    return { assigned: false, agentName, conversationId };
  }

  const nextStatus =
    conversation.status === "resuelto" ? "proceso" : conversation.status;

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      agent_id: agentId,
      human_mode: true,
      agent_control: agentName,
      status: nextStatus,
      updated_at: now,
    })
    .eq("id", conversationId);

  if (updateError) {
    console.warn(`${LOG_PREFIX} assign_failed`, {
      conversationId,
      agentId,
      error: updateError.message,
    });
    return { assigned: false, agentName, conversationId };
  }

  console.log(`${LOG_PREFIX} assigned`, {
    conversationId,
    agentId,
    agentName,
    previousAgentId: conversation.agent_id ?? null,
    status: nextStatus,
  });

  return { assigned: true, agentName, conversationId };
};

/**
 * Prefer payment.conversation_id; else newest open conversation for the client.
 */
export const resolveConversationIdForPayment = async (
  supabase: SupabaseClient,
  input: {
    conversationId?: number | null;
    clientId?: number | null;
  },
): Promise<number | null> => {
  if (
    typeof input.conversationId === "number" &&
    Number.isFinite(input.conversationId) &&
    input.conversationId > 0
  ) {
    return input.conversationId;
  }

  if (
    typeof input.clientId !== "number" ||
    !Number.isFinite(input.clientId) ||
    input.clientId <= 0
  ) {
    return null;
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", input.clientId)
    .neq("status", "resuelto")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`${LOG_PREFIX} resolve_by_client_failed`, {
      clientId: input.clientId,
      error: error.message,
    });
    return null;
  }

  return data?.id ?? null;
};
