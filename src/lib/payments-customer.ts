import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Lê o token Bearer da request (se houver) e retorna dados do perfil logado. */
export async function getOptionalAuthProfile(): Promise<
  | {
      userId: string;
      fullName: string | null;
      email: string | null;
      phone: string | null;
    }
  | null
> {
  try {
    const req = getRequest();
    const auth = req?.headers?.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const supa = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const { data: claimsRes, error } = await supa.auth.getClaims(token);
    if (error || !claimsRes?.claims?.sub) return null;
    const userId = claimsRes.claims.sub as string;

    const { data: profile } = await supa
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", userId)
      .maybeSingle();

    const claimEmail = (claimsRes.claims as { email?: string }).email ?? null;
    return {
      userId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? claimEmail ?? null,
      phone: profile?.phone ?? null,
    };
  } catch {
    return null;
  }
}

function parseBrPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return { country_code: "55", area_code: local.slice(0, 2), number: local.slice(2) };
}

export type ResolvedCustomer = {
  name: string | null;
  email: string | null;
  document: string | null;
  documentType: "CPF" | "CNPJ" | null;
  phone: string | null;
};

/**
 * Combina perfil do usuário logado (prioridade) com dados informados no input.
 * Documento é sempre tomado do input (não existe coluna `document` em profiles).
 */
export async function resolveCustomer(input: {
  customerName?: string;
  customerEmail?: string;
  customerDocument?: string;
  customerPhone?: string;
}): Promise<ResolvedCustomer> {
  const profile = await getOptionalAuthProfile();
  const name = profile?.fullName ?? input.customerName ?? null;
  const email = profile?.email ?? input.customerEmail ?? null;
  const docDigits = input.customerDocument
    ? input.customerDocument.replace(/\D/g, "")
    : "";
  const document = docDigits || null;
  const documentType: "CPF" | "CNPJ" | null = document
    ? document.length === 14
      ? "CNPJ"
      : "CPF"
    : null;
  const phoneRaw = profile?.phone ?? input.customerPhone ?? null;
  const phone = phoneRaw ? phoneRaw.replace(/\D/g, "") : null;
  return { name, email, document, documentType, phone };
}

/**
 * Constrói o objeto `customer` no formato esperado pela Pagar.me.
 * Se `allowAnonymous` e nada foi informado, usa um customer mínimo.
 */
export function buildPagarmeCustomer(
  c: ResolvedCustomer,
  opts: { allowAnonymous: boolean },
) {
  if (opts.allowAnonymous && !c.name && !c.email && !c.document) {
    return {
      name: "Contribuinte",
      email: "contribuinte@proposito.app",
      type: "individual" as const,
      document: "00000000000",
      document_type: "CPF" as const,
    };
  }
  const docType = c.documentType ?? "CPF";
  const obj: Record<string, unknown> = {
    name: c.name ?? "Contribuinte",
    email: c.email ?? "contribuinte@proposito.app",
    type: docType === "CNPJ" ? "company" : "individual",
    document: c.document ?? "00000000000",
    document_type: docType,
  };
  if (c.phone && c.phone.length >= 10) {
    obj.phones = { mobile_phone: parseBrPhone(c.phone) };
  }
  return obj;
}
