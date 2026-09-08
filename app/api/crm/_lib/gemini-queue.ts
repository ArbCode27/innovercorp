import type { SupabaseClient } from "@supabase/supabase-js";

export const GEMINI_QUEUE_NAME = "gemini_messages";

export type ConversationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ConversationJob = {
  id: string;
  conversation_id: number | null;
  customer_message: string | null;
  status: ConversationJobStatus;
  attempts: number;
  last_error: string | null;
  msg_id: number | null;
  trigger_message_id: number | null;
  created_at: string;
  updated_at: string;
};

export type GeminiQueuePayload = {
  jobId: string;
  conversationId: number;
  triggerMessageId: number | null;
  customerMessage?: string | null;
};

export type QueueMessage = {
  msg_id: number;
  read_ct: number;
  enqueued_at?: string;
  vt?: string;
  message: GeminiQueuePayload;
};

const LOG_PREFIX = "[GEMINI_QUEUE]";

const PROCESSING_STALE_MS = 90_000;

export const getGeminiQueueConfig = () => {
  const concurrency = Number.parseInt(
    process.env.GEMINI_MAX_CONCURRENCY || "5",
    10,
  );
  const maxRetries = Number.parseInt(process.env.GEMINI_MAX_RETRIES || "5", 10);
  const batchSize = Number.parseInt(
    process.env.GEMINI_QUEUE_BATCH_SIZE || "10",
    10,
  );
  const vtSeconds = Number.parseInt(
    process.env.GEMINI_QUEUE_VT_SECONDS || "60",
    10,
  );

  return {
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 5,
    maxRetries:
      Number.isFinite(maxRetries) && maxRetries > 0 ? maxRetries : 5,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 10,
    vtSeconds: Number.isFinite(vtSeconds) && vtSeconds > 0 ? vtSeconds : 60,
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toPositiveInt = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

const parseQueuePayload = (raw: unknown): GeminiQueuePayload | null => {
  const row = asRecord(raw);
  if (!row) return null;

  const nested = asRecord(row.message) || asRecord(row.msg) || row;
  const conversationId = toPositiveInt(
    nested.conversationId ?? nested.conversation_id,
  );
  const jobId = String(nested.jobId ?? nested.job_id ?? "").trim();
  if (!conversationId || !jobId) return null;

  const triggerRaw =
    nested.triggerMessageId ?? nested.trigger_message_id ?? null;
  const triggerMessageId =
    triggerRaw === null || triggerRaw === undefined
      ? null
      : toPositiveInt(triggerRaw);

  return {
    jobId,
    conversationId,
    triggerMessageId,
    customerMessage:
      typeof nested.customerMessage === "string"
        ? nested.customerMessage
        : typeof nested.customer_message === "string"
          ? nested.customer_message
          : null,
  };
};

export const normalizeQueueMessages = (raw: unknown): QueueMessage[] => {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.messages)
      ? (asRecord(raw)?.messages as unknown[])
      : Array.isArray(asRecord(raw)?.data)
        ? (asRecord(raw)?.data as unknown[])
        : [];

  const out: QueueMessage[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;

    const msgId = toPositiveInt(row.msg_id ?? row.msgId ?? row.id);
    const payload = parseQueuePayload(row.message ?? row.msg ?? row);
    if (!msgId || !payload) continue;

    const readCt = Number(row.read_ct ?? row.readCt ?? 1);
    out.push({
      msg_id: msgId,
      read_ct: Number.isFinite(readCt) && readCt > 0 ? Math.trunc(readCt) : 1,
      enqueued_at:
        typeof row.enqueued_at === "string" ? row.enqueued_at : undefined,
      vt: typeof row.vt === "string" ? row.vt : undefined,
      message: payload,
    });
  }
  return out;
};

const extractMsgId = (raw: unknown): number | null => {
  if (typeof raw === "number" || typeof raw === "string") {
    return toPositiveInt(raw);
  }
  const row = asRecord(raw);
  if (!row) return null;
  return toPositiveInt(
    row.msg_id ?? row.msgId ?? row.id ?? asRecord(row.data)?.msg_id,
  );
};

/**
 * Insert conversation_jobs + enqueue on pgmq. Soft-fails enqueue details into last_error.
 */
export const enqueueGeminiConversationJob = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    triggerMessageId?: number | null;
    customerMessage?: string | null;
  },
): Promise<{ ok: boolean; jobId: string | null; msgId: number | null }> => {
  const conversationId = toPositiveInt(input.conversationId);
  if (!conversationId) {
    return { ok: false, jobId: null, msgId: null };
  }

  const { data: job, error: insertError } = await supabase
    .from("conversation_jobs")
    .insert({
      conversation_id: conversationId,
      trigger_message_id: input.triggerMessageId ?? null,
      customer_message: input.customerMessage?.trim() || null,
      status: "queued",
      attempts: 0,
    })
    .select("id")
    .single();

  if (insertError || !job?.id) {
    console.error(`${LOG_PREFIX} job_insert_failed`, {
      conversationId,
      error: insertError?.message || "no_row",
    });
    return { ok: false, jobId: null, msgId: null };
  }

  const payload: GeminiQueuePayload = {
    jobId: String(job.id),
    conversationId,
    triggerMessageId: input.triggerMessageId ?? null,
    customerMessage: input.customerMessage?.trim() || null,
  };

  const { data: sendRaw, error: sendError } = await supabase.rpc("queue_send", {
    p_queue_name: GEMINI_QUEUE_NAME,
    p_msg: payload,
    p_delay: 0,
  });

  if (sendError) {
    console.error(`${LOG_PREFIX} queue_send_failed`, {
      conversationId,
      jobId: job.id,
      error: sendError.message,
    });
    await supabase
      .from("conversation_jobs")
      .update({
        status: "failed",
        last_error: `queue_send_failed: ${sendError.message}`,
      })
      .eq("id", job.id);
    return { ok: false, jobId: String(job.id), msgId: null };
  }

  const msgId = extractMsgId(sendRaw);
  if (msgId) {
    await supabase
      .from("conversation_jobs")
      .update({ msg_id: msgId })
      .eq("id", job.id);
  } else {
    console.warn(`${LOG_PREFIX} queue_send_missing_msg_id`, {
      conversationId,
      jobId: job.id,
      raw: sendRaw,
    });
  }

  console.log(`${LOG_PREFIX} enqueued`, {
    conversationId,
    jobId: job.id,
    msgId,
    triggerMessageId: input.triggerMessageId ?? null,
  });

  return { ok: true, jobId: String(job.id), msgId };
};

export const readGeminiQueue = async (
  supabase: SupabaseClient,
  input?: { vtSeconds?: number; qty?: number },
): Promise<QueueMessage[]> => {
  const config = getGeminiQueueConfig();
  const { data, error } = await supabase.rpc("queue_read", {
    p_queue_name: GEMINI_QUEUE_NAME,
    p_vt: input?.vtSeconds ?? config.vtSeconds,
    p_qty: input?.qty ?? config.batchSize,
  });

  if (error) {
    throw new Error(`queue_read_failed: ${error.message}`);
  }

  return normalizeQueueMessages(data);
};

export const deleteGeminiQueueMessage = async (
  supabase: SupabaseClient,
  msgId: number,
): Promise<boolean> => {
  const { error } = await supabase.rpc("queue_delete", {
    p_queue_name: GEMINI_QUEUE_NAME,
    p_msg_id: msgId,
  });
  if (error) {
    console.error(`${LOG_PREFIX} queue_delete_failed`, {
      msgId,
      error: error.message,
    });
    return false;
  }
  return true;
};

export const getConversationJob = async (
  supabase: SupabaseClient,
  jobId: string,
): Promise<ConversationJob | null> => {
  const { data, error } = await supabase
    .from("conversation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle<ConversationJob>();

  if (error) {
    console.error(`${LOG_PREFIX} job_read_failed`, {
      jobId,
      error: error.message,
    });
    return null;
  }
  return data;
};

/**
 * completed → skip permanently.
 * processing + fresh (<90s) → skip this delivery (another worker likely active).
 * otherwise → reclaim for processing.
 */
export const shouldSkipJob = (
  job: ConversationJob | null,
): { skip: boolean; reason: string | null; deleteFromQueue: boolean } => {
  if (!job) {
    return { skip: true, reason: "job_missing", deleteFromQueue: true };
  }
  if (job.status === "completed") {
    return { skip: true, reason: "already_completed", deleteFromQueue: true };
  }
  if (job.status === "processing") {
    const updatedMs = Date.parse(job.updated_at);
    const ageMs = Number.isFinite(updatedMs)
      ? Date.now() - updatedMs
      : Number.POSITIVE_INFINITY;
    if (ageMs < PROCESSING_STALE_MS) {
      return {
        skip: true,
        reason: "processing_fresh",
        deleteFromQueue: false,
      };
    }
  }
  return { skip: false, reason: null, deleteFromQueue: false };
};

export const markJobProcessing = async (
  supabase: SupabaseClient,
  jobId: string,
) => {
  await supabase
    .from("conversation_jobs")
    .update({ status: "processing" })
    .eq("id", jobId);
};

export const markJobCompleted = async (
  supabase: SupabaseClient,
  jobId: string,
) => {
  await supabase
    .from("conversation_jobs")
    .update({
      status: "completed",
      last_error: null,
    })
    .eq("id", jobId);
};

export const markJobFailed = async (
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
) => {
  const job = await getConversationJob(supabase, jobId);
  const attempts = (job?.attempts || 0) + 1;
  await supabase
    .from("conversation_jobs")
    .update({
      status: "failed",
      attempts,
      last_error: errorMessage.slice(0, 2000),
    })
    .eq("id", jobId);
  return attempts;
};

export const moveJobToDeadLetter = async (
  supabase: SupabaseClient,
  input: {
    job: ConversationJob;
    msgId: number;
    errorMessage: string;
    readCt: number;
  },
) => {
  const { error } = await supabase.from("conversation_jobs_dead_letter").insert({
    job_id: input.job.id,
    conversation_id: input.job.conversation_id,
    customer_message: input.job.customer_message,
    attempts: input.job.attempts,
    last_error: input.errorMessage.slice(0, 2000),
    msg_id: input.msgId,
    trigger_message_id: input.job.trigger_message_id,
    payload: {
      read_ct: input.readCt,
      status: input.job.status,
    },
  });

  if (error) {
    console.error(`${LOG_PREFIX} dead_letter_insert_failed`, {
      jobId: input.job.id,
      conversationId: input.job.conversation_id,
      error: error.message,
    });
    return false;
  }

  await supabase
    .from("conversation_jobs")
    .update({
      status: "failed",
      last_error: `dead_letter: ${input.errorMessage}`.slice(0, 2000),
    })
    .eq("id", input.job.id);

  return true;
};

export const countQueuedJobs = async (
  supabase: SupabaseClient,
): Promise<number> => {
  const { count, error } = await supabase
    .from("conversation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  if (error) {
    console.warn(`${LOG_PREFIX} queue_depth_query_failed`, {
      error: error.message,
    });
    return -1;
  }
  return count ?? 0;
};

export const startWorkerRun = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("worker_runs")
    .insert({
      processed_count: 0,
      failed_count: 0,
      dead_letter_count: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error(`${LOG_PREFIX} worker_run_start_failed`, {
      error: error?.message || "no_row",
    });
    return null;
  }
  return String(data.id);
};

export const finishWorkerRun = async (
  supabase: SupabaseClient,
  input: {
    runId: string | null;
    processedCount: number;
    failedCount: number;
    deadLetterCount: number;
    queueDepthAfter: number;
    batchSize: number;
    concurrency: number;
    error?: string | null;
  },
) => {
  if (!input.runId) return;
  await supabase
    .from("worker_runs")
    .update({
      finished_at: new Date().toISOString(),
      processed_count: input.processedCount,
      failed_count: input.failedCount,
      dead_letter_count: input.deadLetterCount,
      queue_depth_after: input.queueDepthAfter,
      batch_size: input.batchSize,
      concurrency: input.concurrency,
      error: input.error?.slice(0, 2000) || null,
    })
    .eq("id", input.runId);
};
