import { BACKEND_BASE_URL } from "@/lib/utils";

export const getAllPayments = async () => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments`);
  const data = await res.json();
  return data;
};

export const deletePayment = async (id: string) => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  return data;
};

export const updateStatusPayment = async (id: string[], accepted: boolean) => {
  const status = accepted ? "APROBADO" : "RECHAZADO";
  const body = {
    ids: id,
    data: {
      status: status,
    },
  };
  console.log(JSON.stringify(body));

  const res = await fetch(`${BACKEND_BASE_URL}/payments`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data;
};

export const approvePayment = async (
  id: string,
  payment: {
    client_id: string;
    amount: string;
    payment_date: string;
    transaction_code: string;
  }
) => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments/approve/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payment),
  });
  const result = await res.json();
  return result;
};
