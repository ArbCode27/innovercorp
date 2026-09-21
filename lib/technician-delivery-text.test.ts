import { describe, expect, it } from "vitest";
import { technicianDeliveryFollowUp } from "./technician-delivery-text";

describe("technicianDeliveryFollowUp", () => {
  it("stays silent after a successful list or ficha", () => {
    expect(technicianDeliveryFollowUp({ delivered: 1, remaining: 0 })).toBe("");
    expect(technicianDeliveryFollowUp({ delivered: 8, remaining: 3 })).toBe("");
  });

  it("explains a failed send", () => {
    expect(technicianDeliveryFollowUp({ delivered: 0, remaining: 0 })).toContain(
      "No pude enviar",
    );
  });
});
