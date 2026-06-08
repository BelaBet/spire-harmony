import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGARME_BASE = "https://api.pagar.me/core/v5";

function authHeader() {
  const key = process.env.PAGARME_SECRET_KEY;
  if (!key) throw new Error("PAGARME_SECRET_KEY não configurado");
  // btoa is available in Workers / browsers; use Buffer fallback if needed
  const token = typeof btoa === "function" ? btoa(`${key}:`) : Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}

async function pagarme<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAGARME_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "message" in body ? (body as { message?: string }).message : res.statusText;
    throw new Error(`Pagar.me ${res.status}: ${msg ?? "erro"}`);
  }
  return body as T;
}

/** Resolve recipientId based on scope: tenant uses tenant_payment_settings; platform uses PLATFORM_RECIPIENT_ID. */
async function resolveRecipientId(
  scope: "tenant" | "platform",
  ctx: { supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>; userId: string },
): Promise<string> {
  if (scope === "platform") {
    // Verify platform role
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pr } = await supabaseAdmin
      .from("platform_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .limit(1)
      .maybeSingle();
    if (!pr) throw new Error("Acesso restrito à plataforma");
    const id = process.env.PLATFORM_RECIPIENT_ID;
    if (!id) throw new Error("PLATFORM_RECIPIENT_ID não configurado");
    return id;
  }
  // tenant scope
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const tenantId = (profile as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) throw new Error("Tenant não encontrado");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tps } = await supabaseAdmin
    .from("tenant_payment_settings")
    .select("pagarme_recipient_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const recId = (tps as { pagarme_recipient_id?: string | null } | null)?.pagarme_recipient_id;
  if (!recId) throw new Error("Esta instituição ainda não está habilitada para receber pagamentos.");
  return recId;
}

const Scope = z.enum(["tenant", "platform"]);

export type BalanceResponse = {
  available: { amount: number };
  waiting_funds: { amount: number };
  transferred: { amount: number };
};

export const getRecipientBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform" }) => z.object({ scope: Scope }).parse(d))
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    return pagarme<BalanceResponse>(`/recipients/${recipientId}/balance`);
  });

export type TransferItem = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  bank_account?: { holder_name?: string; bank?: string; branch_number?: string; account_number?: string };
};

export const getRecipientTransfers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform"; page?: number; size?: number }) =>
    z.object({ scope: Scope, page: z.number().int().min(1).default(1), size: z.number().int().min(1).max(100).default(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    const res = await pagarme<{ data: TransferItem[]; paging?: unknown }>(
      `/recipients/${recipientId}/transfers?page=${data.page}&size=${data.size}`,
    );
    return { items: res.data ?? [] };
  });

export type AnticipationItem = {
  id: string;
  amount: number;
  fee: number;
  anticipation_fee?: number;
  net_amount?: number;
  status: string;
  created_at: string;
  payment_date?: string;
};

export const getRecipientAnticipations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform"; page?: number; size?: number }) =>
    z.object({ scope: Scope, page: z.number().int().min(1).default(1), size: z.number().int().min(1).max(100).default(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    const res = await pagarme<{ data: AnticipationItem[] }>(
      `/recipients/${recipientId}/anticipations?page=${data.page}&size=${data.size}`,
    );
    return { items: res.data ?? [] };
  });

export const getAnticipationLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform"; timeframe?: "start" | "end"; payment_date?: string }) =>
    z.object({
      scope: Scope,
      timeframe: z.enum(["start", "end"]).default("start"),
      payment_date: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    const date = data.payment_date ?? new Date().toISOString().slice(0, 10);
    return pagarme<{
      maximum?: { amount: number; anticipation_fee?: number; fee?: number };
      minimum?: { amount: number };
    }>(`/recipients/${recipientId}/anticipation_limits?timeframe=${data.timeframe}&payment_date=${date}`);
  });

export const simulateAnticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform"; amount: number; timeframe: "start" | "end"; payment_date: string }) =>
    z.object({
      scope: Scope,
      amount: z.number().int().positive(),
      timeframe: z.enum(["start", "end"]),
      payment_date: z.string().min(8),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    return pagarme<{
      amount: number;
      anticipation_fee: number;
      fee: number;
      net_amount: number;
      payment_date: string;
    }>(`/recipients/${recipientId}/anticipations/simulate`, {
      method: "POST",
      body: JSON.stringify({
        amount: data.amount,
        timeframe: data.timeframe,
        payment_date: data.payment_date,
      }),
    });
  });

export const requestAnticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { scope: "tenant" | "platform"; amount: number; timeframe: "start" | "end"; payment_date: string }) =>
    z.object({
      scope: Scope,
      amount: z.number().int().positive(),
      timeframe: z.enum(["start", "end"]),
      payment_date: z.string().min(8),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const recipientId = await resolveRecipientId(data.scope, context as never);
    return pagarme<AnticipationItem>(`/recipients/${recipientId}/anticipations`, {
      method: "POST",
      body: JSON.stringify({
        amount: data.amount,
        timeframe: data.timeframe,
        payment_date: data.payment_date,
      }),
    });
  });

/** Platform-only: aggregate Ticketto fee revenue from paid payments. */
export const getPlatformFeeRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pr } = await supabaseAdmin
      .from("platform_roles")
      .select("role")
      .eq("user_id", (context as { userId: string }).userId)
      .limit(1)
      .maybeSingle();
    if (!pr) throw new Error("Acesso restrito à plataforma");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("ticketto_fee")
      .eq("status", "confirmed");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ ticketto_fee: number | null }>;
    const total = rows.reduce((s, r) => s + (r.ticketto_fee ?? 0), 0);
    return { totalFeeCents: total, count: rows.length };
  });
