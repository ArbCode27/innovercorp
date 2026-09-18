import { describe, expect, it } from "vitest";
import {
  decideTechnicianVerification,
  formatTechnicianWelcome,
  looksLikeOtpCode,
  looksLikeTechnicianFinalizeRequest,
  looksLikeTechnicianNextPage,
  looksLikeTechnicianOfferAccept,
  looksLikeTechnicianResend,
  looksLikeTechnicianTicketRequest,
  shouldDeliverTechnicianTickets,
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
    expect(looksLikeTechnicianOfferAccept("hola")).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: true,
        inboundText: "hola",
        inboundIsCedula: false,
      }),
    ).toBe(false);
    expect(
      shouldDeliverTechnicianTickets({
        justVerified: true,
        inboundText: "sí",
        inboundIsCedula: false,
      }),
    ).toBe(true);
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
  });
});
