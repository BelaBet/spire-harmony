import { z } from "zod";

// URL externa genérica (TicketTO, Sympla, Eventbrite, Hotmart, site próprio…).
// Mantida genérica para permitir integrações futuras sem mudança estrutural.
export const externalEventUrlSchema = z
  .string()
  .trim()
  .min(1, "Informe a URL do evento")
  .max(2048, "URL muito longa")
  .url("URL inválida")
  .refine((u) => /^https?:\/\//i.test(u), "Use http:// ou https://");

export const TICKETTO_BASE = "https://www.ticketto.com.br/";

export function isTickettoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)ticketto\.com\.br$/i.test(u.hostname);
  } catch {
    return false;
  }
}
