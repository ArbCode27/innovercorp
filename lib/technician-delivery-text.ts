/** After cards go out, stay silent unless the tech must page for more. */
export const technicianDeliveryFollowUp = (input: {
  delivered: number;
  remaining: number;
}) => {
  if (input.delivered <= 0) {
    return "No pude enviar los tickets por WhatsApp. Intenta de nuevo.";
  }
  if (input.remaining > 0) {
    return `Quedan ${input.remaining}. Escribe *siguiente* si los necesitas.`;
  }
  return "";
};
