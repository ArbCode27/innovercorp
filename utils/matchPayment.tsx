import { Payment, PaymentBank } from "@/types/payments";

export function getMatchPaymentsLast6(
  payments: Payment[],
  paymentBank: PaymentBank[],
): Payment[] {
  // 1️⃣ Creamos el Set con los últimos 6 de cada Referencia
  const referenciasLast6Set = new Set(
    paymentBank
      .map((item) => item.Referencia)
      .filter((ref): ref is string => Boolean(ref))
      .map((ref) => getLast6(ref)),
  );

  // 2️⃣ Filtramos payments por transaction_code
  return payments.filter((payment) =>
    referenciasLast6Set.has(payment.transaction_code),
  );
}

function getLast6(value: string): string {
  return value.slice(-6);
}
