import { describe, expect, it } from "vitest";
import {
  decideTechnicianVerification,
  formatTechnicianWelcome,
  looksLikeBareTechnicianGreeting,
  looksLikeOtpCode,
  looksLikeTechnicianFinalizePrompt,
  looksLikeTechnicianFinalizeRequest,
  looksLikeTechnicianListOffer,
  looksLikeTechnicianNextPage,
  looksLikeTechnicianObservationReport,
  looksLikeTechnicianOfferAccept,
  looksLikeTechnicianResend,
  looksLikeTechnicianTicketRequest,
  looksLikeTechnicianTicketDetailRequest,
  looksLikeSupervisorOwnTicketsRequest,
  looksLikeSupervisorTeamTicketsRequest,
  parseMonitoredTechnicianQuery,
  parseTechnicianTicketDetailQuery,
  shouldDeliverMonitoredTechnicianQueue,
  shouldDeliverSupervisorTeamTickets,
  shouldDeliverTechnicianTicketDetail,
  shouldDeliverTechnicianTickets,
  shouldUseCannedTechnicianWelcome,
  technicianFirstName,
  type TechnicianIdentityRow,
} from "./technician-identity";

const technician = (
  input?: Partial<TechnicianIdentityRow>,
): TechnicianIdentityRow => ({
  id: "uuid-1",
  employeeId: "tech-1",
  name: "José Pérez",
  phoneLast10: "4123920137",
  whatsappPhoneLast10: null,
  active: true,
  ...input,
});

describe("decideTechnicianVerification", () => {
  it("verifies the registered work WhatsApp without cédula", () => {
    expect(
      decideTechnicianVerification({
        technician: technician(),
        inboundLast10: "04123920137",
        hasDocumentMatch: false,
        claimsTechnicianRole: false,
        conversationIsTechnician: false,
        otpValid: false,
        paymentOverride: false,
      }),
    ).toEqual({ action: "verified", method: "registered_phone" });
  });

  it("verifies a previously bound WhatsApp", () => {
    expect(
      decideTechnicianVerification({
        technician: technician({ whatsappPhoneLast10: "4141112233" }),
        inboundLast10: "+584141112233",
        hasDocumentMatch: false,
        claimsTechnicianRole: false,
        conversationIsTechnician: true,
        otpValid: false,
        paymentOverride: false,
      }),
    ).toEqual({ action: "verified", method: "whatsapp_bound" });
  });

  it("asks for OTP when the cédula matches but the WhatsApp is unknown", () => {
    expect(
      decideTechnicianVerification({
        technician: technician(),
        inboundLast10: "4145556677",
        hasDocumentMatch: true,
        claimsTechnicianRole: false,
        conversationIsTechnician: false,
        otpValid: false,
        paymentOverride: false,
      }),
    ).toEqual({ action: "need_otp" });
  });

  it("does not leak tickets when the ficha has no phone", () => {
    expect(
      decideTechnicianVerification({
        technician: technician({ phoneLast10: null, whatsappPhoneLast10: null }),
        inboundLast10: "4145556677",
        hasDocumentMatch: true,
        claimsTechnicianRole: true,
        conversationIsTechnician: false,
        otpValid: false,
        paymentOverride: false,
      }),
    ).toEqual({ action: "need_registered_phone" });
  });

  it("keeps payment flow when a receipt/payment override is present", () => {
    expect(
      decideTechnicianVerification({
        technician: technician(),
        inboundLast10: "4145556677",
        hasDocumentMatch: true,
        claimsTechnicianRole: false,
        conversationIsTechnician: false,
        otpValid: false,
        paymentOverride: true,
      }),
    ).toEqual({ action: "customer" });
  });

  it("denies inactive technicians", () => {
    expect(
      decideTechnicianVerification({
        technician: technician({ active: false }),
        inboundLast10: "4123920137",
        hasDocumentMatch: true,
        claimsTechnicianRole: true,
        conversationIsTechnician: true,
        otpValid: false,
        paymentOverride: false,
      }),
    ).toEqual({ action: "inactive" });
  });

  it("accepts a valid OTP", () => {
    expect(
      decideTechnicianVerification({
        technician: technician(),
        inboundLast10: "4145556677",
        hasDocumentMatch: true,
        claimsTechnicianRole: false,
        conversationIsTechnician: false,
        otpValid: true,
        paymentOverride: false,
      }),
    ).toEqual({ action: "verified", method: "otp" });
  });
});

describe("technician inbound helpers", () => {
  it("detects ticket requests, pagination and resend", () => {
    expect(looksLikeTechnicianTicketRequest("pásame los pendientes")).toBe(true);
    expect(looksLikeTechnicianNextPage("siguiente lote")).toBe(true);
    expect(looksLikeTechnicianResend("reenviar")).toBe(true);
    expect(looksLikeOtpCode("123456")).toBe(true);
    expect(looksLikeOtpCode("17855434")).toBe(false);
    expect(technicianFirstName("José Pérez")).toBe("José");
  });

  it("greets by name and offers the list instead of sending tickets on phone identification", () => {
    expect(
      formatTechnicianWelcome("José Pérez"),
    ).toBe(
      "Hola José. Te identifiqué como técnico. ¿Quieres que te envíe tu listado de tickets pendientes?",
    );
    expect(looksLikeTechnicianOfferAccept("sí")).toBe(true);
    expect(looksLikeTechnicianOfferAccept("dale")).toBe(true);
    expect(looksLikeTechnicianOfferAccept("listo")).toBe(false);
    expect(looksLikeTechnicianOfferAccept("hola")).toBe(false);
    expect(looksLikeBareTechnicianGreeting("hola")).toBe(true);
    expect(looksLikeTechnicianListOffer(formatTechnicianWelcome("José Pérez"))).toBe(
      true,
    );
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: true,
        inboundText: "hola",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "sí",
        inboundIsCedula: false,
        listOfferPending: true,
      }),
    ).toBe(true);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "sí",
        inboundIsCedula: false,
        listOfferPending: false,
      }),
    ).toBe(false);
    expect(
      shouldUseCannedTechnicianWelcome({
        justVerified: true,
        inboundText: "hola",
        inboundIsCedula: false,
      }),
    ).toBe(true);
    expect(
      shouldUseCannedTechnicianWelcome({
        justVerified: true,
        inboundText: "esa de sandra",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldUseCannedTechnicianWelcome({
        justVerified: false,
        inboundText: "esa de sandra",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "pendientes",
        inboundIsCedula: false,
      }),
    ).toBe(true);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "17855434",
        inboundIsCedula: true,
      }),
    ).toBe(true);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "cierra el ticket 1842",
        inboundIsCedula: false,
      }),
    ).toBe(false);
  });

  it("detects a technician asking to finalize a ticket", () => {
    expect(looksLikeTechnicianFinalizeRequest("cierra el ticket 1842")).toBe(
      true,
    );
    expect(looksLikeTechnicianFinalizeRequest("cierra el #1842")).toBe(true);
    expect(looksLikeTechnicianFinalizeRequest("finaliza el 1842")).toBe(true);
    expect(looksLikeTechnicianFinalizeRequest("terminé el ticket")).toBe(true);
    expect(looksLikeTechnicianFinalizeRequest("ya está listo el caso")).toBe(
      true,
    );
    expect(looksLikeTechnicianFinalizeRequest("Finaliza Sandra key")).toBe(
      true,
    );
    expect(looksLikeTechnicianFinalizeRequest("cierra a María López")).toBe(
      true,
    );
    expect(looksLikeTechnicianFinalizeRequest("por favor finaliza sandra key")).toBe(
      true,
    );
    expect(looksLikeTechnicianFinalizeRequest("finaliza")).toBe(false);
    expect(looksLikeTechnicianFinalizeRequest("listo")).toBe(false);
    expect(looksLikeTechnicianFinalizeRequest("sí")).toBe(false);
    expect(looksLikeTechnicianFinalizeRequest("pásame los tickets")).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "Finaliza Sandra key",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "esa de sandra",
        inboundIsCedula: false,
        listOfferPending: false,
      }),
    ).toBe(false);
  });

  it("routes list vs ficha without sending photos on the index", () => {
    expect(looksLikeTechnicianTicketDetailRequest("pásame los pendientes")).toBe(
      false,
    );
    expect(looksLikeTechnicianTicketDetailRequest("mis tickets")).toBe(false);
    expect(looksLikeTechnicianTicketDetailRequest("detalle de tania")).toBe(true);
    expect(looksLikeTechnicianTicketDetailRequest("ficha de pedro")).toBe(true);
    expect(looksLikeTechnicianTicketDetailRequest("el 3")).toBe(true);
    expect(looksLikeTechnicianTicketDetailRequest("Tania Ortiz")).toBe(true);
    expect(looksLikeTechnicianTicketDetailRequest("esa de sandra")).toBe(false);
    expect(looksLikeTechnicianTicketDetailRequest("cierra el ticket 1842")).toBe(
      false,
    );
    expect(parseTechnicianTicketDetailQuery("detalle de tania")).toEqual({
      publicId: null,
      clientName: "tania",
      listIndex: null,
    });
    expect(parseTechnicianTicketDetailQuery("el 3")).toEqual({
      publicId: null,
      clientName: null,
      listIndex: 3,
    });
    expect(parseTechnicianTicketDetailQuery("#1842")).toEqual({
      publicId: 1842,
      clientName: null,
      listIndex: null,
    });
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "detalle de tania",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTicketDetail({ inboundText: "detalle de tania" }),
    ).toBe(true);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "pásame los pendientes",
        inboundIsCedula: false,
      }),
    ).toBe(true);
  });

  it("does not treat media placeholder words as technician ticket detail requests or client names", () => {
    expect(looksLikeTechnicianTicketDetailRequest("audio")).toBe(false);
    expect(looksLikeTechnicianTicketDetailRequest("Audio")).toBe(false);
    expect(looksLikeTechnicianTicketDetailRequest("imagen")).toBe(false);
    expect(looksLikeTechnicianTicketDetailRequest("video")).toBe(false);
    expect(parseTechnicianTicketDetailQuery("Audio")).toEqual({
      publicId: null,
      clientName: null,
      listIndex: null,
    });
    expect(parseTechnicianTicketDetailQuery("audio")).toEqual({
      publicId: null,
      clientName: null,
      listIndex: null,
    });
    expect(
      shouldDeliverTechnicianTicketDetail({ inboundText: "Audio" }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTicketDetail({ inboundText: "audio" }),
    ).toBe(false);
  });

  it("lets a supervisor ask for another technician queue", () => {
    expect(parseMonitoredTechnicianQuery("dame los tickets asignados a joel")).toEqual(
      {
        names: ["joel"],
        wantsCountOnly: false,
        scope: "pending",
        temporal: "all",
      },
    );
    expect(
      parseMonitoredTechnicianQuery(
        "dame los tickets resueltos de jonathan por favor",
      ),
    ).toEqual({
      names: ["jonathan"],
      wantsCountOnly: false,
      scope: "done",
      temporal: "all",
    });
    expect(parseMonitoredTechnicianQuery("cuántos tickets tiene alan")).toEqual({
      names: ["alan"],
      wantsCountOnly: true,
      scope: "pending",
      temporal: "all",
    });
    expect(
      parseMonitoredTechnicianQuery("cuántos tickets tienen joel y alan").names,
    ).toEqual(["joel", "alan"]);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "dame los tickets asignados a joel",
        inboundIsCedula: false,
        isSupervisor: true,
      }),
    ).toBe(false);
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: true,
        inboundText: "dame los tickets asignados a joel",
      }),
    ).toBe(true);
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: true,
        inboundText: "cuántos tickets tiene alan",
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "mis tickets",
        inboundIsCedula: false,
        isSupervisor: true,
      }),
    ).toBe(true);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: false,
        inboundText: "pendientes",
        inboundIsCedula: false,
        isSupervisor: true,
      }),
    ).toBe(false);
    expect(parseMonitoredTechnicianQuery("el cliente tiene internet").names).toEqual(
      [],
    );
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: true,
        inboundText: "el cliente tiene internet",
      }),
    ).toBe(false);
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: false,
        inboundText: "dame los tickets asignados a joel",
      }),
    ).toBe(false);
  });

  it("handles technician queries with temporal expressions (hoy, mañana, día) without misidentifying client names", () => {
    const temporalQueries = [
      "Tickets del día de hoy... Por favor",
      "Tickets para el día de mañana. Por favor",
      "tickets de hoy",
      "tickets para hoy",
      "tickets de mañana",
      "tickets para mañana",
      "tickets del día",
      "tickets del dia de hoy",
      "pendientes de hoy",
      "cola de hoy",
      "mis tickets de hoy",
      "Tickets por favor",
    ];

    for (const query of temporalQueries) {
      expect(looksLikeTechnicianTicketDetailRequest(query)).toBe(false);
      expect(parseTechnicianTicketDetailQuery(query).clientName).toBeNull();
      expect(
        shouldDeliverTechnicianTicketDetail({ inboundText: query }),
      ).toBe(false);
      expect(
        shouldDeliverTechnicianTickets({
          justVerified: false,
          inboundText: query,
          inboundIsCedula: false,
          isSupervisor: false,
        }),
      ).toBe(true);
    }
  });

  it("handles supervisor queries with temporal expressions cleanly", () => {
    expect(
      parseMonitoredTechnicianQuery(
        "dame los tickets de Jonathan del día de hoy por favor",
      ),
    ).toEqual({
      names: ["Jonathan"],
      wantsCountOnly: false,
      scope: "pending",
      temporal: "today",
    });
    expect(
      parseMonitoredTechnicianQuery(
        "tickets de joel para mañana",
      ),
    ).toEqual({
      names: ["joel"],
      wantsCountOnly: false,
      scope: "pending",
      temporal: "tomorrow",
    });
    expect(
      parseMonitoredTechnicianQuery(
        "dame los tickets resueltos del dia de hoy del tecnico Joel",
      ),
    ).toEqual({
      names: ["Joel"],
      wantsCountOnly: false,
      scope: "done",
      temporal: "today",
    });
    expect(
      parseMonitoredTechnicianQuery("Dame los tickets del dia de hoy").names,
    ).toEqual([]);
    expect(
      parseMonitoredTechnicianQuery("dame los tickets resueltos del dia de hoy").names,
    ).toEqual([]);
    expect(
      parseMonitoredTechnicianQuery("dame los tickets de soporte del dia de hoy").names,
    ).toEqual([]);
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: true,
        inboundText: "dame los tickets de Jonathan del día de hoy por favor",
      }),
    ).toBe(true);
    expect(
      shouldDeliverMonitoredTechnicianQueue({
        isSupervisor: true,
        inboundText: "dame los tickets resueltos del dia de hoy del tecnico Joel",
      }),
    ).toBe(true);
    expect(
      shouldDeliverSupervisorTeamTickets({
        isSupervisor: true,
        inboundText: "Dame los tickets del dia de hoy",
      }),
    ).toBe(true);
    expect(
      shouldDeliverSupervisorTeamTickets({
        isSupervisor: true,
        inboundText: "dame los tickets resueltos del dia de hoy",
      }),
    ).toBe(true);
    expect(
      shouldDeliverSupervisorTeamTickets({
        isSupervisor: true,
        inboundText: "dame los tickets de soporte del dia de hoy",
      }),
    ).toBe(true);
  });

  describe("supervisor own tickets vs team tickets differentiation", () => {
    it("identifies supervisor asking specifically for their own tickets", () => {
      const ownQueries = [
        "mis tickets",
        "mis tickets de hoy",
        "mis pendientes",
        "mi ruta",
        "mis casos",
        "lo que tengo asignado yo",
        "tickets asignados a mi",
        "lo mio por favor",
        "mi cola",
      ];

      for (const query of ownQueries) {
        expect(looksLikeSupervisorOwnTicketsRequest(query)).toBe(true);
        expect(
          shouldDeliverTechnicianTickets({
            justVerified: false,
            inboundText: query,
            inboundIsCedula: false,
            isSupervisor: true,
          }),
        ).toBe(true);
        expect(
          shouldDeliverSupervisorTeamTickets({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(false);
        expect(
          shouldDeliverMonitoredTechnicianQueue({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(false);
      }
    });

    it("identifies supervisor asking for general team tickets", () => {
      const teamQueries = [
        "tickets",
        "los tickets",
        "dame los tickets",
        "tickets de hoy",
        "tickets para hoy",
        "tickets del día",
        "tickets de mañana",
        "pendientes",
        "pendientes de hoy",
        "listado de tickets",
        "cola",
        "ruta",
        "tickets de todos",
      ];

      for (const query of teamQueries) {
        expect(looksLikeSupervisorOwnTicketsRequest(query)).toBe(false);
        expect(looksLikeSupervisorTeamTicketsRequest(query)).toBe(true);
        expect(
          shouldDeliverTechnicianTickets({
            justVerified: false,
            inboundText: query,
            inboundIsCedula: false,
            isSupervisor: true,
          }),
        ).toBe(false);
        expect(
          shouldDeliverSupervisorTeamTickets({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(true);
        expect(
          shouldDeliverMonitoredTechnicianQueue({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(false);
      }
    });

    it("identifies supervisor asking for a specific technician queue", () => {
      const specificQueries = [
        "tickets de joel",
        "dame los tickets de Jonathan",
        "cola de alan",
      ];

      for (const query of specificQueries) {
        expect(looksLikeSupervisorOwnTicketsRequest(query)).toBe(false);
        expect(
          shouldDeliverSupervisorTeamTickets({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(false);
        expect(
          shouldDeliverMonitoredTechnicianQueue({
            isSupervisor: true,
            inboundText: query,
          }),
        ).toBe(true);
      }
    });

    describe("manager ticket queries (pending today, resolved today, resolved today for specific technician)", () => {
      it("Gerente: Dame los tickets del dia de hoy -> sends pending team tickets", () => {
        const text = "Dame los tickets del dia de hoy";
        const query = parseMonitoredTechnicianQuery(text);
        expect(query.names).toEqual([]);
        expect(query.scope).toBe("pending");
        expect(query.temporal).toBe("today");
        expect(shouldDeliverSupervisorTeamTickets({ isSupervisor: true, inboundText: text })).toBe(true);
        expect(shouldDeliverMonitoredTechnicianQueue({ isSupervisor: true, inboundText: text })).toBe(false);
      });

      it("Gerente: dame los tickets resueltos del dia de hoy -> sends resolved team tickets for today", () => {
        const text = "dame los tickets resueltos del dia de hoy";
        const query = parseMonitoredTechnicianQuery(text);
        expect(query.names).toEqual([]);
        expect(query.scope).toBe("done");
        expect(query.temporal).toBe("today");
        expect(shouldDeliverSupervisorTeamTickets({ isSupervisor: true, inboundText: text })).toBe(true);
        expect(shouldDeliverMonitoredTechnicianQueue({ isSupervisor: true, inboundText: text })).toBe(false);
      });

      it("Gerente: dame los tickets resueltos del dia de hoy del tecnico Joel -> sends Joel's resolved tickets for today", () => {
        const text = "dame los tickets resueltos del dia de hoy del tecnico Joel";
        const query = parseMonitoredTechnicianQuery(text);
        expect(query.names).toEqual(["Joel"]);
        expect(query.scope).toBe("done");
        expect(query.temporal).toBe("today");
        expect(shouldDeliverSupervisorTeamTickets({ isSupervisor: true, inboundText: text })).toBe(false);
        expect(shouldDeliverMonitoredTechnicianQueue({ isSupervisor: true, inboundText: text })).toBe(true);
      });

      it("Gerente: dame los tickets de soporte del dia de hoy -> sends pending team tickets for today", () => {
        const text = "dame los tickets de soporte del dia de hoy";
        const query = parseMonitoredTechnicianQuery(text);
        expect(query.names).toEqual([]);
        expect(query.scope).toBe("pending");
        expect(query.temporal).toBe("today");
        expect(shouldDeliverSupervisorTeamTickets({ isSupervisor: true, inboundText: text })).toBe(true);
        expect(shouldDeliverMonitoredTechnicianQueue({ isSupervisor: true, inboundText: text })).toBe(false);
      });
    });

    it("regular technicians always get their own tickets and never team list", () => {
      const queries = ["tickets", "dame los tickets", "tickets de hoy", "mis tickets"];

      for (const query of queries) {
        expect(
          shouldDeliverTechnicianTickets({
            justVerified: false,
            inboundText: query,
            inboundIsCedula: false,
            isSupervisor: false,
          }),
        ).toBe(true);
        expect(
          shouldDeliverSupervisorTeamTickets({
            isSupervisor: false,
            inboundText: query,
          }),
        ).toBe(false);
      }
    });

    describe("technician ticket finalization observation & audio routing", () => {
      it("detects bot prompt waiting for closing observation", () => {
        expect(
          looksLikeTechnicianFinalizePrompt(
            "Para cerrar el ticket de **Luismar Martinez**, ¿podrías indicarme brevemente qué trabajo realizaste en sitio? (puede ser por texto o nota de voz) 😊",
          ),
        ).toBe(true);
        expect(
          looksLikeTechnicianFinalizePrompt(
            "Para cerrar #2004 (Jeiderlin Sevilla), indícame brevemente la observación o trabajo realizado.",
          ),
        ).toBe(true);
        expect(
          looksLikeTechnicianFinalizePrompt(
            "Para cerrar el ticket de **Jeiderlin Sevilla (#2004)** necesito que me indiques brevemente:",
          ),
        ).toBe(true);
        expect(
          looksLikeTechnicianFinalizePrompt(
            "Hola José Pérez. Te identifiqué como técnico. ¿Quieres que te envíe tu listado de tickets pendientes?",
          ),
        ).toBe(false);
        expect(
          looksLikeTechnicianFinalizePrompt("Tienes 1 ticket pendiente:"),
        ).toBe(false);
      });

      it("detects technician observation reports and prevents misrouting to ticket detail", () => {
        const observationReports = [
          "La figura (conector óptico) estaba partida, se cambió la figura del cliente, servicio quedó operativo en 26.60",
          "Buenas tardes, ya cambié la fibra partida y el servicio quedó operativo y conforme",
          "Se reemplazó roseta averiada, potencia en -22 dBm",
          "Se cambió la figura óptica que estaba rota, trabajo completo y funcionando con potencia de -21 dBm",
          "Buenas tardes amigo, ya se terminó el servicio de Luismar, todo completo y navegando",
        ];

        for (const report of observationReports) {
          expect(looksLikeTechnicianObservationReport(report)).toBe(true);
          expect(looksLikeTechnicianTicketDetailRequest(report)).toBe(false);
          expect(
            shouldDeliverTechnicianTicketDetail({ inboundText: report }),
          ).toBe(false);
          expect(
            shouldDeliverTechnicianTickets({
              justVerified: false,
              inboundText: report,
              inboundIsCedula: false,
            }),
          ).toBe(false);
          expect(parseTechnicianTicketDetailQuery(report).clientName).toBeNull();
        }
      });
    });
  });
});
