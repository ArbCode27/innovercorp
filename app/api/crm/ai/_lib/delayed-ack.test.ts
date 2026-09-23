import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACK_DELAY_MS, startDelayedAck } from "./reply-to-conversation";

vi.mock("./guaranteed-reply", () => ({
  sendProcessingAck: vi.fn(),
}));

vi.mock("./ai-runs", () => ({
  markAiRunAckSent: vi.fn(),
}));

import { sendProcessingAck } from "./guaranteed-reply";
import { markAiRunAckSent } from "./ai-runs";

describe("ACK_DELAY_MS and startDelayedAck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has a default delay of exactly 1 minute (60,000 ms)", () => {
    expect(ACK_DELAY_MS).toBe(60_000);
  });

  it("does NOT send processing feedback when the AI responds in less than 1 minute", async () => {
    const supabase = {} as unknown as SupabaseClient;

    const delayedAck = startDelayedAck({
      supabase,
      conversationId: 100,
      triggerMessageId: 1,
      customerPhone: "584120000000",
      intent: "general",
      runHandle: null,
    });

    // Simulate AI finishing after 15 seconds (less than 1 minute)
    await vi.advanceTimersByTimeAsync(15_000);

    // AI finishes, so we cancel the delayed ack
    delayedAck.cancel();

    // Advance beyond 1 minute to ensure timer was truly cleared
    await vi.advanceTimersByTimeAsync(60_000);

    const result = await delayedAck.wait();

    expect(result.sent).toBe(false);
    expect(sendProcessingAck).not.toHaveBeenCalled();
    expect(markAiRunAckSent).not.toHaveBeenCalled();
  });

  it("sends processing feedback when the AI takes more than 1 minute", async () => {
    const supabase = {} as unknown as SupabaseClient;
    vi.mocked(sendProcessingAck).mockResolvedValueOnce({
      ok: true,
      reason: "ack_sent",
      recovery: "ack",
    });

    const delayedAck = startDelayedAck({
      supabase,
      conversationId: 200,
      triggerMessageId: 2,
      customerPhone: "584120000000",
      intent: "general",
      runHandle: { runId: "test-run-1" },
    });

    // Advance 59 seconds: should not have sent yet
    await vi.advanceTimersByTimeAsync(59_000);
    expect(sendProcessingAck).not.toHaveBeenCalled();

    // Advance 2 more seconds (total 61s > 1 minute): timer triggers
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await delayedAck.wait();

    expect(sendProcessingAck).toHaveBeenCalledTimes(1);
    expect(sendProcessingAck).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        conversationId: 200,
        triggerMessageId: 2,
      }),
    );
    expect(markAiRunAckSent).toHaveBeenCalledWith(supabase, {
      runId: "test-run-1",
    });
    expect(result.sent).toBe(true);
  });
});
