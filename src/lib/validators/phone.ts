const DDD = /^\d{2}$/;
const NUMBER = /^\d{8,9}$/;
export const PHONE_TYPES = ["mobile", "landline", "whatsapp"] as const;
export type PhoneType = (typeof PHONE_TYPES)[number];

export const validateDDD = (v: string) => DDD.test(v) || "DDD inválido.";
export const validatePhoneNumber = (v: string) =>
  NUMBER.test(v.replace(/\D/g, "")) || "Telefone inválido.";
export const validatePhoneType = (v: string) =>
  (PHONE_TYPES as readonly string[]).includes(v) || "Tipo de telefone inválido.";
