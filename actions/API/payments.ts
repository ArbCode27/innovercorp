import { BACKEND_BASE_URL } from "@/lib/utils";
import { cache } from "react";

export const getAllPayments = async (page: string) => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments?page=${page}`, {
    cache: "no-store",
  });
  const data = await res.json();
  return data;
};

export const getPaymentsByBank = async (bank: string) => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments/${bank}`, {
    cache: "no-store",
  });
  const data = await res.json();
  return data;
};

export const getAllPromisePayments = async () => {
  const res = await fetch(`${BACKEND_BASE_URL}/payment-promise`, {
    cache: "no-store",
  });
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
  },
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

export const approvePromisePayment = async (
  id: string,
  data: {
    valid_until: string;
    contract_id: string;
  },
) => {
  const res = await fetch(
    `${BACKEND_BASE_URL}contracts/${id}/payment_promises`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valid_until: data.valid_until,
      }),
    },
  );
  const result = await res.json();
  return result;
};
