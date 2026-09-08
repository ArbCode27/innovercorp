import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import { replyToConversationWithGemini } from "@/app/api/crm/ai/_lib/reply-to-conversation";
import { sendGuaranteedClientReply } from "@/app/api/crm/ai/_lib/guaranteed-reply";
import {
  countQueuedJobs,
  deleteGeminiQueueMessage,
  finishWorkerRun,
  getConversationJob,
  getGeminiQueueConfig,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
  moveJobToDeadLetter,
  readGeminiQueue,
  shouldSkipJob,
  startWorkerRun,
  type QueueMessage,
} from "@/app/api/crm/_lib/gemini-queue";
import { sendWorkerSlackAlert } from "@/app/api/crm/_lib/worker-alerts";

export const runtime = "nodejs";
/** Hobby/Pro serverless budget; keep batch size conservative. */
export const maxDuration = 60;

const LOG_PREFIX = "[GEMINI_WORKER]";

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const getSupabase = () =>
  createClient(
    getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

const isAuthorized = (req: NextRequest) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(`${LOG_PREFIX} missing_CRON_SECRET`);
    return false;
  }
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim() || "";
  return bearer === secret || querySecret === secret;
};

const processQueueMessage = async (
  supabase: ReturnType<typeof getSupabase>,
  item: QueueMessage,
  maxRetries: number,
): Promise<"processed" | "failed" | "skipped" | "dead_letter"> => {
  const { msg_id: msgId, read_ct: readCt, message } = item;
  const { jobId, conversationId, triggerMessageId } = message;

  const job = await getConversationJob(supabase, jobId);
  const skip = shouldSkipJob(job);

  if (skip.skip) {
    console.log(`${LOG_PREFIX} skip`, {
      jobId,
      conversationId,
      msgId,
      reason: skip.reason,
      deleteFromQueue: skip.deleteFromQueue,
    });
    if (skip.deleteFromQueue) {
      await deleteGeminiQueueMessage(supabase, msgId);
    }
    return "skipped";
  }

  if (!job) {
    await deleteGeminiQueueMessage(supabase, msgId);
    return "skipped";
  }

  await markJobProcessing(supabase, jobId);

  try {
    const result = await replyToConversationWithGemini(supabase, {
      conversationId,
      triggerMessageId,
    });

    if (result.ok || result.skipped) {
      await markJobCompleted(supabase, jobId);
      await deleteGeminiQueueMessage(supabase, msgId);
      console.log(`${LOG_PREFIX} job_done`, {
        jobId,
        conversationId,
        msgId,
        ok: result.ok,
        skipped: Boolean(result.skipped),
        reason: result.reason,
      });
      return "processed";
    }

    throw new Error(result.reason || "gemini_no_reply");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error(`${LOG_PREFIX} job_failed`, {
      jobId,
      conversationId,
      msgId,
      readCt,
      error: errorMessage,
    });

    const attempts = await markJobFailed(supabase, jobId, errorMessage);
    const freshJob = (await getConversationJob(supabase, jobId)) || {
      ...job,
      attempts,
      last_error: errorMessage,
    };

    // Exhausted retries → dead letter + delete from queue.
    if (readCt > maxRetries) {
      await moveJobToDeadLetter(supabase, {
        job: freshJob,
        msgId,
        errorMessage,
        readCt,
      });
      await deleteGeminiQueueMessage(supabase, msgId);

      try {
        await sendGuaranteedClientReply(supabase, {
          conversationId,
          triggerMessageId,
          errorMessage,
        });
      } catch (fallbackError) {
        console.error(`${LOG_PREFIX} dead_letter_fallback_failed`, {
          conversationId,
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
      }

      return "dead_letter";
    }

    // Leave message for pgmq visibility-timeout retry.
    return "failed";
  }
};

const runWorker = async (req: NextRequest) => {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getGeminiQueueConfig();
  const supabase = getSupabase();
  const runId = await startWorkerRun(supabase);

  let processedCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;
  let skippedCount = 0;
  let runError: string | null = null;
  let queueDepthAfter = -1;

  try {
    const messages = await readGeminiQueue(supabase, {
      vtSeconds: config.vtSeconds,
      qty: config.batchSize,
    });

    console.log(`${LOG_PREFIX} batch_read`, {
      runId,
      count: messages.length,
      batchSize: config.batchSize,
      concurrency: config.concurrency,
      vtSeconds: config.vtSeconds,
    });

    const limit = pLimit(config.concurrency);
    const outcomes = await Promise.all(
      messages.map((item) =>
        limit(async () => processQueueMessage(supabase, item, config.maxRetries)),
      ),
    );

    for (const outcome of outcomes) {
      if (outcome === "processed") processedCount += 1;
      else if (outcome === "failed") failedCount += 1;
      else if (outcome === "dead_letter") deadLetterCount += 1;
      else skippedCount += 1;
    }

    queueDepthAfter = await countQueuedJobs(supabase);
    console.log(`${LOG_PREFIX} batch_finished`, {
      runId,
      processedCount,
      failedCount,
      deadLetterCount,
      skippedCount,
      queueDepthAfter,
    });

    if (failedCount > 0 || deadLetterCount > 0) {
      await sendWorkerSlackAlert({
        title: "Gemini worker: fallos en el lote",
        text: "La ejecución del worker reportó errores o dead-letter.",
        fields: {
          runId,
          processed: processedCount,
          failed: failedCount,
          dead_letter: deadLetterCount,
          queue_depth_after: queueDepthAfter,
        },
      });
    }

    if (queueDepthAfter > config.batchSize * 2) {
      console.warn(`${LOG_PREFIX} queue_backlog`, {
        runId,
        queueDepthAfter,
        batchSize: config.batchSize,
        hint: "Considera subir GEMINI_QUEUE_BATCH_SIZE o la frecuencia del scheduler externo",
      });
    }
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} run_crashed`, {
      runId,
      error: runError,
    });
    await sendWorkerSlackAlert({
      title: "Gemini worker: ejecución fallida",
      text: runError,
      fields: { runId },
    });
  } finally {
    await finishWorkerRun(supabase, {
      runId,
      processedCount,
      failedCount,
      deadLetterCount,
      queueDepthAfter,
      batchSize: config.batchSize,
      concurrency: config.concurrency,
      error: runError,
    });
  }

  return NextResponse.json({
    ok: !runError,
    runId,
    processedCount,
    failedCount,
    deadLetterCount,
    skippedCount,
    queueDepthAfter,
    batchSize: config.batchSize,
    concurrency: config.concurrency,
    error: runError,
  });
};

export async function GET(req: NextRequest) {
  return runWorker(req);
}

export async function POST(req: NextRequest) {
  return runWorker(req);
}
