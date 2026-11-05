import { describe, expect, it } from "vitest";
import { applyListFilters, type ListCrmPaymentsFilters } from "./crm-payments";

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
      bank: "Venezuela",
      q: "Pedro",
    };

    applyListFilters(query, filters, { includeStatus: true });

    // Date omitted
    expect(query.calls.some((c) => c.method === "gte")).toBe(false);

    // Status and bank preserved
    const eqCalls = query.calls.filter((c) => c.method === "eq");
    expect(eqCalls).toEqual([
      { method: "eq", args: ["status", "APROBADO"] },
      { method: "eq", args: ["bank", "Venezuela"] },
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
});
