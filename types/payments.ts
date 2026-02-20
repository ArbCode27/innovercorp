export type Payment = {
  id: string;
  client_id: string;
  name: string;
  amount: string;
  payment_date: string; // ISO date string
  bank: string;
  comment: string | null;
  transaction_code: string;
  status: "EN_PROCESO" | "APROBADO" | "RECHAZADO"; // puedes ampliar según tus estados
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  is_promise: boolean;
};

export type PaymentBank = {
  Referencia: string;
};

export type PaymentPromise = {
  id: string; // corresponde a String en Prisma
  valid_until: Date; // DateTime en Prisma → Date en TS
  contract_id: string;
  amount: string; // si luego quieres, podrías usar number en lugar de string
  bank: string;
  name: string;
  transaction_code: string;
  status: "EN_PROCESO" | "APROBADO" | "RECHAZADO"; // puedes ampliar según tus estados
  payment_date: string; // ISO date string
  created_at: string; // DateTime → Date
  updated_at: string; // DateTime → Date
};

export type ExcelPayment = {
  monto: number;
  fecha: Date;
  banco: string;
  referencia: string;
  cedula: string;
};
