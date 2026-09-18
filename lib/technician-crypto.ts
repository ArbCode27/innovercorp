import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { documentDigits } from "./phone-match";

export const resolveTechnicianHmacSecret = (secret?: string | null) => {
  const value = String(
    secret ||
      process.env.CRM_TECHNICIAN_HMAC_SECRET ||
      process.env.CRM_INTERNAL_SECRET ||
      "",
  ).trim();
  return value || null;
};

export const hashTechnicianSecret = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");

export const hashTechnicianDocument = (
  document: string | null | undefined,
  secret: string,
) => {
  const digits = documentDigits(document);
  return digits ? hashTechnicianSecret(`document:${digits}`, secret) : null;
};

export const documentLast4 = (document: string | null | undefined) => {
  const digits = documentDigits(document);
  return digits ? digits.slice(-4) : null;
};

export const generateTechnicianOtp = () =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");

export const hashTechnicianOtp = (input: {
  technicianId: string;
  conversationId: number;
  code: string;
  secret: string;
}) =>
  hashTechnicianSecret(
    `otp:${input.technicianId}:${input.conversationId}:${input.code}`,
    input.secret,
  );

export const secretsEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};
