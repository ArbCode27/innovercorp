import { Payment, PaymentBank } from "@/types/payments";

export function getMatchPaymentsLast6(
  payments: Payment[],
  paymentBank: PaymentBank[],
): Payment[] {
  const bankCodes = new Set(
    paymentBank.map((bank) => bank.Referencia.slice(-6)),
  );

  const matchedPayments: Payment[] = payments.filter((payment) =>
    bankCodes.has(payment.transaction_code),
  );

  return matchedPayments;
}
