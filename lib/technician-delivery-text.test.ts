import { describe, expect, it } from "vitest";
import { technicianDeliveryFollowUp } from "./technician-delivery-text";

describe("technicianDeliveryFollowUp", () => {
  it("stays silent after a complete ticket dump", () => {
    expect(technicianDeliveryFollowUp({ delivered: 1, remaining: 0 })).toBe("");
  });

  it("only hints when more pages remain", () => {
    expect(technicianDeliveryFollowUp({ delivered: 8, remaining: 3 })).toBe(
      "Quedan 3. Escribe *siguiente* si los necesitas.",
    );
  });

  it("explains a failed send", () => {
    expect(technicianDeliveryFollowUp({ delivered: 0, remaining: 0 })).toContain(
      "No pude enviar",
    );
  });
});
