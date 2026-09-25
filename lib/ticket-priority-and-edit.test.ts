import { describe, expect, it } from "vitest";
import {
  createCasoSchema,
  editCasoSchema,
  manageCasoSchema,
  TICKET_PRIORITIES,
  ticketPriorityLabels,
} from "../app/crm/_lib/wispro-caso-schema";

describe("Ticket priority and edit schema", () => {
  it("includes all 4 priority levels with descriptive labels", () => {
    expect(TICKET_PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
    expect(ticketPriorityLabels.low).toBe("Baja");
    expect(ticketPriorityLabels.medium).toBe("Media");
    expect(ticketPriorityLabels.high).toBe("Alta");
    expect(ticketPriorityLabels.urgent).toBe("Urgente");
  });

  it("defaults createCasoSchema priority to medium", () => {
    const parsed = createCasoSchema.parse({
      title: "Falla de conectividad",
      description: "Cliente sin servicio",
      categoryId: "00000000-0000-0000-0000-000000000001",
    });

    expect(parsed.priority).toBe("medium");
  });

  it("allows setting custom priority on create", () => {
    const parsed = createCasoSchema.parse({
      title: "Falla urgente",
      description: "Fibra cortada",
      categoryId: "00000000-0000-0000-0000-000000000001",
      priority: "urgent",
    });

    expect(parsed.priority).toBe("urgent");
  });

  it("validates editCasoSchema with valid fields", () => {
    const validEdit = {
      issueId: "00000000-0000-0000-0000-000000000002",
      title: "Problema resuelto parcialmente",
      cause: "Revisar ONT",
      description: "Se cambió conector",
      priority: "high" as const,
      addressText: "Calle 10 con Av 4",
      status: "scheduled" as const,
    };

    const parsed = editCasoSchema.safeParse(validEdit);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priority).toBe("high");
      expect(parsed.data.title).toBe("Problema resuelto parcialmente");
    }
  });

  it("allows replacing or clearing the facade image on edit", () => {
    const withImage = editCasoSchema.safeParse({
      issueId: "00000000-0000-0000-0000-000000000002",
      title: "Falla de fibra",
      priority: "high",
      facadeMediaUrl: "https://cdn.example/fachada.jpg",
      facadeMessageId: 42,
    });
    expect(withImage.success).toBe(true);
    if (withImage.success) {
      expect(withImage.data.facadeMediaUrl).toBe("https://cdn.example/fachada.jpg");
      expect(withImage.data.facadeMessageId).toBe(42);
    }

    const cleared = editCasoSchema.safeParse({
      issueId: "00000000-0000-0000-0000-000000000002",
      title: "Falla de fibra",
      priority: "high",
      facadeMediaUrl: "",
      facadeMessageId: null,
    });
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect(cleared.data.facadeMediaUrl).toBeNull();
      expect(cleared.data.facadeMessageId).toBeNull();
    }
  });

  it("validates manageCasoSchema for edit and delete actions", () => {
    const editAction = manageCasoSchema.safeParse({
      action: "edit",
      issueId: "00000000-0000-0000-0000-000000000003",
      title: "Ticket editado",
      priority: "urgent",
    });
    expect(editAction.success).toBe(true);

    const deleteAction = manageCasoSchema.safeParse({
      action: "delete",
      issueId: "00000000-0000-0000-0000-000000000003",
    });
    expect(deleteAction.success).toBe(true);

    const validFinalize = manageCasoSchema.safeParse({
      action: "finalize",
      issueId: "00000000-0000-0000-0000-000000000003",
      resolutionObservation: "Conector mecánico partido en roseta",
      resolutionSolution: "Reemplazo de conector mecánico y calibración de potencia",
      clientStatus: "Operativo y conforme",
    });
    expect(validFinalize.success).toBe(true);

    const invalidFinalizeMissingFields = manageCasoSchema.safeParse({
      action: "finalize",
      issueId: "00000000-0000-0000-0000-000000000003",
    });
    expect(invalidFinalizeMissingFields.success).toBe(false);
  });
});
