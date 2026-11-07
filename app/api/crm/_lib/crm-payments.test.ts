import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyListFilters,
  approveCrmPayment,
  rejectCrmPayment,
  markCrmPaymentApprovalError,
  updateCrmPaymentStatus,
  updateCrmPaymentDetails,
  type CrmPayment,
  type ListCrmPaymentsFilters,
} from "./crm-payments";

type MockCall = { method: string; args: unknown[] };

const createMockQuery = () => {
  const calls: MockCall[] = [];
  const query = {
    gte: (...args: unknown[]) => {
      calls.push({ method: "gte", args });
      return query;
    },
    lte: (...args: unknown[]) => {
      calls.push({ method: "lte", args });
      return query;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return query;
    },
    or: (...args: unknown[]) => {
      calls.push({ method: "or", args });
      return query;
    },
    calls,
  };
  return query;
};

describe("applyListFilters", () => {
  it("applies date filters when no search query is present", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      q: null,
    };

    applyListFilters(query, filters, { includeStatus: false });

    const gteCall = query.calls.find((c) => c.method === "gte");
    const lteCall = query.calls.find((c) => c.method === "lte");

    expect(gteCall).toEqual({
      method: "gte",
      args: ["payment_date", "2026-11-01"],
    });
    expect(lteCall).toEqual({
      method: "lte",
      args: ["payment_date", "2026-11-05"],
    });
  });

  it("omits date filters when search query is present to search across all clients", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      q: "Maria Gonzalez",
    };

    applyListFilters(query, filters, { includeStatus: false });

    const hasDateFilters = query.calls.some(
      (c) => c.method === "gte" || c.method === "lte",
    );
    expect(hasDateFilters).toBe(false);

    const orCall = query.calls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    expect(orCall?.args[0]).toContain("client_name.ilike.%Maria Gonzalez%");
  });

  it("handles formatted cédulas by searching both text and extracted digits", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      q: "V-28.123.456",
    };

    applyListFilters(query, filters, { includeStatus: false });

    // Ensure date filter was bypassed
    expect(query.calls.some((c) => c.method === "gte")).toBe(false);

    const orCall = query.calls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    // Raw query
    expect(orCall?.args[0]).toContain("client_name.ilike.%V-28.123.456%");
    // Extracted digits
    expect(orCall?.args[0]).toContain("cedula.ilike.%28123456%");
  });

  it("applies status and bank filters alongside search", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-05",
      to: "2026-11-05",
      status: "APROBADO",
      bank: "Binance",
      q: "Pedro",
    };

    applyListFilters(query, filters, { includeStatus: true });

    // Date omitted
    expect(query.calls.some((c) => c.method === "gte")).toBe(false);

    // Status and bank preserved
    const eqCalls = query.calls.filter((c) => c.method === "eq");
    expect(eqCalls).toEqual([
      { method: "eq", args: ["status", "APROBADO"] },
      { method: "eq", args: ["bank", "Binance"] },
    ]);
  });

  it("applies approved_at timestamp filter when dateType is 'approval'", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      dateType: "approval",
      q: null,
    };

    applyListFilters(query, filters, { includeStatus: false });

    const gteCall = query.calls.find((c) => c.method === "gte");
    const lteCall = query.calls.find((c) => c.method === "lte");

    expect(gteCall).toEqual({
      method: "gte",
      args: ["approved_at", "2026-11-01T00:00:00.000-04:00"],
    });
    expect(lteCall).toEqual({
      method: "lte",
      args: ["approved_at", "2026-11-05T23:59:59.999-04:00"],
    });
  });

  it("applies payment_date filter when dateType is 'payment'", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      dateType: "payment",
      q: null,
    };

    applyListFilters(query, filters, { includeStatus: false });

    const gteCall = query.calls.find((c) => c.method === "gte");
    const lteCall = query.calls.find((c) => c.method === "lte");

    expect(gteCall).toEqual({
      method: "gte",
      args: ["payment_date", "2026-11-01"],
    });
    expect(lteCall).toEqual({
      method: "lte",
      args: ["payment_date", "2026-11-05"],
    });
  });

  it("defaults to status APROBADO when dateType is approval and no status specified", () => {
    const query = createMockQuery();
    const filters: ListCrmPaymentsFilters = {
      from: "2026-11-01",
      to: "2026-11-05",
      dateType: "approval",
      q: null,
    };

    applyListFilters(query, filters, { includeStatus: true });

    const eqCall = query.calls.find((c) => c.method === "eq");
    expect(eqCall).toEqual({
      method: "eq",
      args: ["status", "APROBADO"],
    });
  });
});

describe("crm-payments status transitions approved_at column", () => {
  const dummyPayment: CrmPayment = {
    id: "pay-1",
    client_id: 1,
    conversation_id: 1,
    message_id: 1,
    submitted_by_agent_id: 1,
    wispro_client_id: null,
    client_name: "Test Client",
    cedula: "12345678",
    phone_id: "584120000000",
    amount: 30,
    amount_raw: "30",
    bank: "Bancamiga",
    transaction_code: "123456",
    payment_date: "2026-11-06",
    comment: null,
    status: "EN_PROCESO",
    source: "advisor",
    external_payment_id: null,
    external_api_status: null,
    error_message: null,
    receipt_media_url: null,
    receipt_metadata: {},
    approved_at: null,
    created_at: "2026-11-06T10:00:00Z",
    updated_at: "2026-11-06T10:00:00Z",
  };

  const createCaptureClient = (captured: {
    table?: string;
    updatePayload?: Record<string, unknown>;
  }) => {
    return {
      from: (table: string) => {
        captured.table = table;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: dummyPayment, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            captured.updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: { id: "pay-1", ...payload }, error: null }),
                  single: async () => ({ data: { id: "pay-1", ...payload }, error: null }),
                }),
              }),
            };
          },
        };
      },
    } as unknown as SupabaseClient;
  };

  it("approveCrmPayment writes approved_at column directly in database update", async () => {
    const captured: { table?: string; updatePayload?: Record<string, unknown> } = {};
    const supabase = createCaptureClient(captured);

    await approveCrmPayment(supabase, {
      payment: dummyPayment,
      manualApproval: true,
      manualNote: "Aprobación de prueba",
    });

    expect(captured.table).toBe("crm_payments");
    expect(captured.updatePayload?.status).toBe("APROBADO");
    expect(typeof captured.updatePayload?.approved_at).toBe("string");
    expect(captured.updatePayload?.approved_at).toBeTruthy();
  });

  it("rejectCrmPayment clears approved_at column to null", async () => {
    const captured: { table?: string; updatePayload?: Record<string, unknown> } = {};
    const supabase = createCaptureClient(captured);

    await rejectCrmPayment(supabase, "pay-1");

    expect(captured.table).toBe("crm_payments");
    expect(captured.updatePayload?.status).toBe("RECHAZADO");
    expect(captured.updatePayload?.approved_at).toBeNull();
  });

  it("markCrmPaymentApprovalError clears approved_at column to null", async () => {
    const captured: { table?: string; updatePayload?: Record<string, unknown> } = {};
    const supabase = createCaptureClient(captured);

    await markCrmPaymentApprovalError(supabase, {
      paymentId: "pay-1",
      message: "Wispro API timeout",
    });

    expect(captured.table).toBe("crm_payments");
    expect(captured.updatePayload?.status).toBe("ERROR");
    expect(captured.updatePayload?.approved_at).toBeNull();
    expect(captured.updatePayload?.error_message).toBe("Wispro API timeout");
  });

  it("updateCrmPaymentStatus sets approved_at on APROBADO and null on other statuses", async () => {
    const captured: { table?: string; updatePayload?: Record<string, unknown> } = {};
    const supabase = createCaptureClient(captured);

    await updateCrmPaymentStatus(supabase, {
      id: "pay-1",
      status: "APROBADO",
    });
    expect(typeof captured.updatePayload?.approved_at).toBe("string");

    await updateCrmPaymentStatus(supabase, {
      id: "pay-1",
      status: "RECHAZADO",
    });
    expect(captured.updatePayload?.approved_at).toBeNull();
  });

  it("updateCrmPaymentDetails updates payment fields and records audit metadata", async () => {
    const captured: { table?: string; updatePayload?: Record<string, unknown> } = {};
    const supabase = createCaptureClient(captured);

    await updateCrmPaymentDetails(supabase, {
      id: "pay-1",
      client_name: "Carlos Sanchez",
      cedula: "V87654321",
      amount: 45.5,
      bank: "Banplus",
      transaction_code: "TX998877",
      payment_date: "2026-11-05",
      comment: "Ajuste de referencia",
      status: "APROBADO",
      edited_by_agent_id: 42,
    });

    expect(captured.table).toBe("crm_payments");
    expect(captured.updatePayload?.client_name).toBe("Carlos Sanchez");
    expect(captured.updatePayload?.cedula).toBe("V87654321");
    expect(captured.updatePayload?.amount).toBe(45.5);
    expect(captured.updatePayload?.amount_raw).toBe("45.5");
    expect(captured.updatePayload?.bank).toBe("Banplus");
    expect(captured.updatePayload?.transaction_code).toBe("TX998877");
    expect(captured.updatePayload?.payment_date).toBe("2026-11-05");
    expect(captured.updatePayload?.comment).toBe("Ajuste de referencia");
    expect(captured.updatePayload?.status).toBe("APROBADO");
    expect(typeof captured.updatePayload?.approved_at).toBe("string");

    const meta = captured.updatePayload?.receipt_metadata as Record<string, unknown>;
    expect(meta.last_edited_by_agent_id).toBe(42);
    expect(typeof meta.last_edited_at).toBe("string");
  });
});
