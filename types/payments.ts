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
