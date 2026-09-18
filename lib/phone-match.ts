export const digitsOnly = (value: string | null | undefined) =>
  String(value || "").replace(/\D/g, "");

export const phoneLast10 = (value: string | null | undefined) => {
  const digits = digitsOnly(value);
  if (!digits) return null;
  return digits.length <= 10 ? digits : digits.slice(-10);
};

export const phonesMatch = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const a = phoneLast10(left);
  const b = phoneLast10(right);
  return Boolean(a && b && a === b);
};
