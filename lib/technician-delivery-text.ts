/** After the list or ficha goes out, stay silent. Pagination lives in the list. */
export const technicianDeliveryFollowUp = (input: {
  delivered: number;
  remaining?: number;
}) => {
  if (input.delivered <= 0) {
    return "No pude enviar los tickets por WhatsApp. Intenta de nuevo.";
  }
  return "";
};
