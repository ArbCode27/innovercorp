import { describe, expect, it } from "vitest";
import {
  formatSupervisorTeamTicketsReport,
  formatTechnicianCaption,
  formatTechnicianList,
} from "./technician-report";
import { collectCasoContextFromMessages } from "./caso-chat-context";

describe("formatTechnicianCaption", () => {
  it("includes name, phone, cause and maps link", () => {
    const caption = formatTechnicianCaption({
      wisproPublicId: 1842,
      kindLabel: "Visita técnica",
      clientName: "Yeitzel Pérez",
      clientPhone: "04123920137",
      cause: "sin internet",
      title: "Falla",
      addressText: "Calle X, Mume",
      mapsUrl: "https://maps.google.com/?q=10.12,-64.68",
      latitude: 10.12,
      longitude: -64.68,
      windowStart: null,
      windowEnd: null,
      facadeMediaUrl: "https://example.com/fachada.jpg",
    });
    expect(caption).toContain("Ticket #1842");
    expect(caption).toContain("Yeitzel Pérez");
    expect(caption).toContain("04123920137");
    expect(caption).toContain("sin internet");
    expect(caption).toContain("https://maps.google.com/?q=10.12,-64.68");
  });
});

describe("formatTechnicianList", () => {
  it("lists name, title and location without ticket ids or photos", () => {
    const text = formatTechnicianList([
      {
        wisproPublicId: 1,
        clientName: "Ana Pérez",
        clientPhone: "1",
        cause: "ONT",
        title: "Falla",
        addressText: "Calle 12, Mume",
        mapsUrl: "https://maps.google.com/?q=1,1",
        latitude: 1,
        longitude: 1,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: "https://cdn.example/fachada.jpg",
      },
      {
        wisproPublicId: null,
        clientName: "Pedro Guzmán",
        clientPhone: "2",
        cause: null,
        title: "VERIFICACION DE INTERMITENCIA",
        addressText: null,
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: null,
      },
    ]);
    expect(text).toContain("Tienes 2 tickets pendientes:");
    expect(text).toContain("1. Ana Pérez");
    expect(text).toContain("   ONT");
    expect(text).toContain("   Ubicación: Calle 12, Mume");
    expect(text).toContain("2. Pedro Guzmán");
    expect(text).toContain("   VERIFICACION DE INTERMITENCIA");
    expect(text).toContain("   Ubicación: Sin ubicación");
    expect(text).toContain("ficha completa");
    expect(text).not.toContain("#1");
    expect(text).not.toContain("s/n");
    expect(text).not.toContain("0412");
    expect(text).not.toContain("fachada.jpg");
    expect(text).not.toContain("maps.google.com");
  });

  it("continues numbering across pages", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 9,
          clientName: "Katiuska",
          clientPhone: null,
          cause: "Conector",
          title: "Conector",
          addressText: "Caja 4",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
        },
      ],
      { startIndex: 8, remaining: 0 },
    );
    expect(text).toContain("Tienes 9 tickets pendientes:");
    expect(text).toContain("9. Katiuska");
  });

  it("omits the detail hint for supervisor lists", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 1,
          clientName: "Ana Pérez",
          clientPhone: "1",
          cause: "ONT",
          title: "Falla",
          addressText: "Calle 12, Mume",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
        },
      ],
      { heading: "Joel tiene 1 ticket pendiente:", hint: null },
    );
    expect(text).toContain("Joel tiene 1 ticket pendiente:");
    expect(text).toContain("1. Ana Pérez");
    expect(text).not.toContain("ficha completa");
  });

  it("groups and orders tickets by scheduled date in format DD/MM/YYYY: with continuous numbering", () => {
    const text = formatTechnicianList([
      {
        wisproPublicId: 101,
        clientName: "EDMARY RODRIGUEZ",
        clientPhone: "04141234567",
        cause: "Luz roja LOS (pérdida de señal óptica)",
        title: "Sin internet",
        addressText: "Textiles La Fila S.A.",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-20T14:00:00.000Z",
        windowEnd: "2026-09-20T16:00:00.000Z",
        facadeMediaUrl: null,
      },
      {
        wisproPublicId: 102,
        clientName: "JUAN PEREZ",
        clientPhone: "04249876543",
        cause: "Corte de fibra",
        title: "Revisión técnica",
        addressText: "Calle Los Rosales",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-22T10:00:00.000Z",
        windowEnd: "2026-09-22T12:00:00.000Z",
        facadeMediaUrl: null,
      },
    ]);

    expect(text).toContain("20/09/2026:");
    expect(text).toContain("1. EDMARY RODRIGUEZ");
    expect(text).toContain("22/09/2026:");
    expect(text).toContain("2. JUAN PEREZ");
  });

  it("formats done tickets with resolution date and done scope header", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 50,
          clientName: "MARIA GOMEZ",
          clientPhone: null,
          cause: "Cambio de router",
          title: "Instalación",
          addressText: "Av Bolívar",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
          status: "done",
          closedAt: "2026-09-21T18:30:00.000Z",
        },
      ],
      { scope: "done" },
    );

    expect(text).toContain("Tienes 1 ticket resuelto:");
    expect(text).toContain("1. MARIA GOMEZ");
    expect(text).toContain("Resuelto:");
  });
});

describe("collectCasoContextFromMessages", () => {
  it("prefers WhatsApp location pin and last inbound image", () => {
    const ctx = collectCasoContextFromMessages([
      {
        id: 1,
        type: "in",
        media_type: "image",
        media_url: "https://cdn.example/fachada.jpg",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        type: "in",
        latitude: 10.2,
        longitude: -64.7,
        location_name: "Casa",
        location_address: "Calle 1",
      },
    ]);
    expect(ctx.mapsUrl).toBe("https://maps.google.com/?q=10.2,-64.7");
    expect(ctx.facade?.mediaUrl).toBe("https://cdn.example/fachada.jpg");
    expect(ctx.addressText).toContain("Casa");
  });
});

describe("formatSupervisorTeamTicketsReport", () => {
  it("returns clean message when no tickets are registered", () => {
    const text = formatSupervisorTeamTicketsReport([]);
    expect(text).toContain("No hay tickets pendientes registrados en el sistema.");
  });

  it("groups tickets by technician and date with priorities and hints", () => {
    const text = formatSupervisorTeamTicketsReport([
      {
        wisproPublicId: 1042,
        employeeName: "Joel Cárdenas",
        clientName: "Katherine Inojosa",
        clientPhone: "04141234567",
        cause: "Pérdida de señal óptica",
        title: "Falla de internet",
        addressText: "Brisas del Rosario",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-22T15:00:00.000Z",
        windowEnd: "2026-09-22T17:00:00.000Z",
        facadeMediaUrl: null,
        priority: "urgent",
      },
      {
        wisproPublicId: 1045,
        employeeName: "Joel Cárdenas",
        clientName: "Pedro Morales",
        clientPhone: null,
        cause: "Instalación nueva",
        title: "Instalación",
        addressText: "Casco Central",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-22T18:00:00.000Z",
        windowEnd: "2026-09-22T20:00:00.000Z",
        facadeMediaUrl: null,
        priority: "medium",
      },
      {
        wisproPublicId: 1048,
        employeeName: "Alan Brito",
        clientName: "Carlos Gómez",
        clientPhone: null,
        cause: "Cambio de router",
        title: "Revisión",
        addressText: "Sector Mume",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-23T13:00:00.000Z",
        windowEnd: "2026-09-23T15:00:00.000Z",
        facadeMediaUrl: null,
        priority: "high",
      },
      {
        wisproPublicId: 1050,
        employeeName: null,
        clientName: "Luis Martínez",
        clientPhone: null,
        cause: "Revisión de cable",
        title: "Soporte",
        addressText: "Los Olivos",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: null,
        priority: "low",
      },
    ]);

    expect(text).toContain("Listado de Tickets del Equipo");
    expect(text).toContain("Total: 4 tickets activos distribuidos en 3 colas.");

    // Technicians present
    expect(text).toContain("ALAN BRITO");
    expect(text).toContain("JOEL CÁRDENAS");
    expect(text).toContain("SIN ASIGNAR");

    // Dates present
    expect(text).toContain("22/09/2026:");
    expect(text).toContain("23/09/2026:");
    expect(text).toContain("Fecha por definir:");

    // Clients and IDs
    expect(text).toContain("*Katherine Inojosa* (#1042)");
    expect(text).toContain("*Pedro Morales* (#1045)");
    expect(text).toContain("*Carlos Gómez* (#1048)");
    expect(text).toContain("*Luis Martínez* (#1050)");

    // Priority badges
    expect(text).toContain("🔥 Urgente");
    expect(text).toContain("⚠️ Alta");

    // Supervisor guide footer
    expect(text).toContain("tickets de [Nombre]");
    expect(text).toContain("mis tickets");
  });

  it("formats resolved tickets grouped by technician and closed date", () => {
    const text = formatSupervisorTeamTicketsReport(
      [
        {
          wisproPublicId: 2001,
          employeeName: "Joel Cárdenas",
          clientName: "Andrea Gómez",
          clientPhone: "04121234567",
          cause: "Reconexión de fibra",
          title: "Soporte",
          addressText: "Av. Principal",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: "2026-09-22T10:00:00.000Z",
          windowEnd: "2026-09-22T12:00:00.000Z",
          facadeMediaUrl: null,
          status: "done",
          closedAt: "2026-09-22T17:40:00.000Z",
        },
        {
          wisproPublicId: 2002,
          employeeName: "Alan Brito",
          clientName: "José Delgado",
          clientPhone: null,
          cause: "Cambio de conector",
          title: "Visita",
          addressText: "Calle 4, El Rosario",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: "2026-09-22T09:00:00.000Z",
          windowEnd: "2026-09-22T11:00:00.000Z",
          facadeMediaUrl: null,
          status: "done",
          closedAt: "2026-09-22T15:15:00.000Z",
        },
      ],
      { scope: "done", dateTitle: "de Hoy (22/09/2026)", temporalFilter: "today" },
    );

    expect(text).toContain("📋 *Tickets Resueltos del Equipo de Hoy (22/09/2026)*");
    expect(text).toContain("Total: 2 tickets resueltos distribuidos en 2 colas.");
    expect(text).toContain("👷 *ALAN BRITO* (1):");
    expect(text).toContain("👷 *JOEL CÁRDENAS* (1):");
    expect(text).toContain("📅 22/09/2026:");
    expect(text).toContain("*Andrea Gómez* (#2001)");
    expect(text).toContain("Resuelto:");
    expect(text).toContain("Ubicación: Av. Principal");
    expect(text).toContain("*José Delgado* (#2002)");
    expect(text).toContain("Ubicación: Calle 4, El Rosario");
  });

  it("formats single technician resolved queue indented by date and technician header", () => {
    const text = formatSupervisorTeamTicketsReport(
      [
        {
          wisproPublicId: 2001,
          employeeName: "Joel Cárdenas",
          clientName: "Andrea Gómez",
          clientPhone: "04121234567",
          cause: "Reconexión de fibra",
          title: "Soporte",
          addressText: "Av. Principal",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
          status: "done",
          closedAt: "2026-09-22T17:40:00.000Z",
        },
      ],
      {
        scope: "done",
        technicianName: "Joel Cárdenas",
        dateTitle: "de Hoy (22/09/2026)",
        temporalFilter: "today",
      },
    );

    expect(text).toContain("📋 *Tickets Resueltos de Joel Cárdenas de Hoy (22/09/2026)*");
    expect(text).toContain("Total: 1 ticket resuelto.");
    expect(text).toContain("👷 *JOEL CÁRDENAS* (1):");
    expect(text).toContain("📅 22/09/2026:");
    expect(text).toContain("1. *Andrea Gómez* (#2001)");
    expect(text).toContain("Reconexión de fibra");
    expect(text).toContain("Resuelto:");
    expect(text).toContain("Ubicación: Av. Principal");
    expect(text).toContain("Para ver la lista completa del equipo escribe «tickets»");
  });

  it("returns appropriate empty message for resolved queries", () => {
    const emptyTeam = formatSupervisorTeamTicketsReport([], {
      scope: "done",
      temporalFilter: "today",
    });
    expect(emptyTeam).toContain("No hay tickets resueltos el día de hoy");

    const emptyTech = formatSupervisorTeamTicketsReport([], {
      scope: "done",
      technicianName: "Joel Cárdenas",
      temporalFilter: "today",
    });
    expect(emptyTech).toContain("Joel Cárdenas no tiene tickets resueltos el día de hoy");
  });
});
