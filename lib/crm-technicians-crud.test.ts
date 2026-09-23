import { describe, expect, it, vi } from "vitest";
import {
  deleteTechnician,
  listAllTechnicians,
  normalizeTechnicianPhoneLast10,
  toggleTechnicianStatus,
  upsertTechnician,
} from "./crm-technicians";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("normalizeTechnicianPhoneLast10", () => {
  it("normalizes Venezuelan 11-digit local format", () => {
    expect(normalizeTechnicianPhoneLast10("04141234567")).toBe("4141234567");
    expect(normalizeTechnicianPhoneLast10("04129876543")).toBe("4129876543");
  });

  it("normalizes international +58 format", () => {
    expect(normalizeTechnicianPhoneLast10("+584141234567")).toBe("4141234567");
    expect(normalizeTechnicianPhoneLast10("+58 414-123-4567")).toBe("4141234567");
  });

  it("rejects invalid or too short phones", () => {
    expect(normalizeTechnicianPhoneLast10("12345")).toBeNull();
    expect(normalizeTechnicianPhoneLast10("")).toBeNull();
    expect(normalizeTechnicianPhoneLast10(null)).toBeNull();
  });
});

describe("CRUD de Técnicos en Base de Datos", () => {
  it("bloquea la creación si ya existe un técnico activo con el mismo WhatsApp", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "tech-1", name: "Joel Cárdenas" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      upsertTechnician(
        mockSupabase,
        {
          name: "Carlos Pérez",
          whatsappPhone: "04141234567",
          active: true,
        },
        1,
      ),
    ).rejects.toThrow(/Ya existe un técnico activo/);
  });

  it("crea un nuevo técnico exitosamente si no hay colisión", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "crm_technicians") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "tech-uuid-1",
                    employee_id: "emp-uuid-1",
                    name: "Joel Cárdenas",
                    document: "V-12345678",
                    document_last4: "5678",
                    whatsapp_phone_last10: "4141234567",
                    whatsapp_phone_e164: "+584141234567",
                    phone_last10: "4141234567",
                    phone_e164: "+584141234567",
                    active: true,
                    notes: "Zona Norte",
                    created_by: 1,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    const result = await upsertTechnician(
      mockSupabase,
      {
        name: "Joel Cárdenas",
        whatsappPhone: "04141234567",
        document: "V-12345678",
        notes: "Zona Norte",
        active: true,
      },
      1,
    );

    expect(result.name).toBe("Joel Cárdenas");
    expect(result.whatsappPhoneLast10).toBe("4141234567");
    expect(result.document).toBe("V-12345678");
    expect(result.active).toBe(true);
  });

  it("conmuta el estado activo de un técnico", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "tech-uuid-1",
                name: "Joel Cárdenas",
                active: true,
                whatsapp_phone_last10: "4141234567",
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "tech-uuid-1",
                  name: "Joel Cárdenas",
                  active: false,
                  whatsapp_phone_last10: "4141234567",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await toggleTechnicianStatus(mockSupabase, "tech-uuid-1");
    expect(result.active).toBe(false);
  });

  it("elimina un técnico por su id", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      deleteTechnician(mockSupabase, "tech-uuid-1"),
    ).resolves.toBeUndefined();
  });

  it("lista técnicos ordenados por activos primero", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: "1", name: "Joel Cárdenas", active: true },
                { id: "2", name: "Pedro Silva", active: false },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const list = await listAllTechnicians(mockSupabase);
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Joel Cárdenas");
    expect(list[0].active).toBe(true);
    expect(list[1].active).toBe(false);
  });
});
