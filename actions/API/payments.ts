import { BACKEND_BASE_URL } from "@/lib/utils";

export const getAllPayments = async () => {
  const res = await fetch(`${BACKEND_BASE_URL}/payments`);
  const data = await res.json();
  return data;
};
