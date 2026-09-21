import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  findActiveSupervisorByPhone,
  invalidateSupervisorCache,
  normalizeSupervisorPhoneLast10,
  upsertSupervisor,
} from "./crm-supervisors";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("normalizeSupervisorPhoneLast10", () => {
  it("normalizes Venezuelan 11-digit local format", () => {
    expect(normalizeSupervisorPhoneLast10("04142132785")).toBe("4142132785");
    expect(normalizeSupervisorPhoneLast10("04123920137")).toBe("4123920137");
  });

  it("normalizes international +58 format with or without spaces/dashes", () => {
    expect(normalizeSupervisorPhoneLast10("+584142132785")).toBe("4142132785");
    expect(normalizeSupervisorPhoneLast10("+58 414-213-2785")).toBe("4142132785");
    expect(normalizeSupervisorPhoneLast10("+58 (414) 213.2785")).toBe("4142132785");
  });

  it("accepts exactly 10 digits", () => {
    expect(normalizeSupervisorPhoneLast10("4142132785")).toBe("4142132785");
  });

  it("rejects phone numbers with fewer than 10 digits", () => {
    expect(normalizeSupervisorPhoneLast10("123456789")).toBeNull();
    expect(normalizeSupervisorPhoneLast10("0414-123")).toBeNull();
    expect(normalizeSupervisorPhoneLast10("")).toBeNull();
    expect(normalizeSupervisorPhoneLast10(null)).toBeNull();
    expect(normalizeSupervisorPhoneLast10(undefined)).toBeNull();
  });
});

describe("Unicidad entre gerentes activos", () => {
  beforeEach(() => {
    invalidateSupervisorCache();
  });

  it("bloquea la creación de un nuevo gerente activo si ya existe uno con el mismo teléfono", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "existing-uuid-1", name: "Gerente Existente" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      upsertSupervisor(
        mockSupabase,
        {
          name: "Nuevo Gerente",
          phone: "04142132785",
          active: true,
        },
        1,
      ),
    ).rejects.toThrow(/Ya existe un gerente activo/);
  });

  it("permite actualizar el mismo gerente conservando su teléfono", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "crm_supervisors") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "supervisor-1", name: "Jonathan" },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "supervisor-1",
                      name: "Jonathan Actualizado",
                      phone_last10: "4142132785",
                      active: true,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    const result = await upsertSupervisor(
      mockSupabase,
      {
        id: "supervisor-1",
        name: "Jonathan Actualizado",
        phone: "04142132785",
        active: true,
      },
      1,
    );

    expect(result.name).toBe("Jonathan Actualizado");
    expect(result.phoneLast10).toBe("4142132785");
  });
});

describe("Gerente inactivo no autorizado", () => {
  beforeEach(() => {
    invalidateSupervisorCache();
  });

  it("retorna el gerente si está activo", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "sup-active",
                name: "Gerente Activo",
                phone_last10: "4142132785",
                active: true,
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await findActiveSupervisorByPhone(
      mockSupabase,
      "+584142132785",
    );
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Gerente Activo");
    expect(result?.active).toBe(true);
  });

  it("no autoriza a un gerente inactivo (retorna null)", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            // Only active=true are queried, so inactive records return empty
            data: [],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await findActiveSupervisorByPhone(
      mockSupabase,
      "04149999999",
    );
    expect(result).toBeNull();
  });
});

describe("Validación de rol admin", () => {
  const checkAdminAccess = (role: string | null | undefined): boolean => {
    const normalized = String(role || "").toLowerCase();
    return normalized === "admin" || normalized === "administrador";
  };

  it("autoriza a roles admin y administrador", () => {
    expect(checkAdminAccess("admin")).toBe(true);
    expect(checkAdminAccess("ADMIN")).toBe(true);
    expect(checkAdminAccess("administrador")).toBe(true);
    expect(checkAdminAccess("Administrador")).toBe(true);
  });

  it("rechaza usuarios que no son admin", () => {
    expect(checkAdminAccess("agent")).toBe(false);
    expect(checkAdminAccess("agente")).toBe(false);
    expect(checkAdminAccess("tecnico")).toBe(false);
    expect(checkAdminAccess(null)).toBe(false);
    expect(checkAdminAccess(undefined)).toBe(false);
  });
});
