import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tela "Doações": lista resumida + detalhe por doação.
 *
 * Regras de acesso:
 * - Staff de tenant (manager/admin): só vê doações do próprio tenant_id,
 *   valor mostrado é líquido (sem taxa visível).
 * - Super admin (platform_roles): vê doações de todos os tenants, com
 *   filtro opcional por tenant, valor bruto + taxa administrativa visíveis.
 *
 * Endereço de cobrança (cartão/boleto) não tem coluna própria — é extraído
 * em tempo real de payments.gateway_request (jsonb), que é bloqueado para
 * o client (REVOKE SELECT) e só acessado aqui via supabaseAdmin no server.
 * Doações via Pix não têm endereço (não é coletado nesse fluxo).
 */

type Ctx = {
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>;
  userId: string;
};

async function resolveAccess(ctx: Ctx) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: roleRow } = await supabaseAdmin
    .from("platform_roles")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .limit(1)
    .maybeSingle();
  if (roleRow) return { isPlatformAdmin: true as const, tenantId: null as string | null };

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const tenantId = (profile as { tenant_id?: string } | null)?.tenant_id ?? null;
  if (!tenantId) throw new Error("Tenant não encontrado.");

  const { data: staffRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", tenantId)
    .in("role", ["manager", "admin"])
    .limit(1)
    .maybeSingle();
  if (!staffRow) throw new Error("Acesso restrito a administradores da igreja.");

  return { isPlatformAdmin: false as const, tenantId };
}

export type DonationListItem = {
  id: string;
  donorName: string | null;
  tenantId: string;
  tenantName: string | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  amountCents: number;
  status: string | null;
  createdAt: string;
};

export const getDonationsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      periodStart: string;
      periodEnd: string;
      tenantId?: string;
      page?: number;
      size?: number;
    }) =>
      z
        .object({
          periodStart: z.string().min(8),
          periodEnd: z.string().min(8),
          tenantId: z.string().uuid().optional(),
          page: z.number().int().min(1).default(1),
          size: z.number().int().min(1).max(100).default(20),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const access = await resolveAccess(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("donations_staff" as never)
      .select(
        "id, tenant_id, donor_name, payment_method, card_brand, gross_amount, net_amount, created_at, payment_id",
      )
      .gte("created_at", `${data.periodStart}T00:00:00.000Z`)
      .lte("created_at", `${data.periodEnd}T23:59:59.999Z`)
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.size, data.page * data.size - 1);

    if (!access.isPlatformAdmin) {
      query = query.eq("tenant_id", access.tenantId as string);
    } else if (data.tenantId) {
      query = query.eq("tenant_id", data.tenantId);
    }

    type Row = {
      id: string;
      tenant_id: string;
      donor_name: string | null;
      payment_method: string | null;
      card_brand: string | null;
      gross_amount: number | null;
      net_amount: number | null;
      created_at: string;
      payment_id: string | null;
    };
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Row[];

    // status vem de payments.status (1 query agregada, evita N+1)
    const paymentIds = [...new Set(list.map((r) => r.payment_id).filter(Boolean))] as string[];
    const statusByPaymentId = new Map<string, string>();
    if (paymentIds.length > 0) {
      const { data: pays } = await supabaseAdmin
        .from("payments")
        .select("id, status")
        .in("id", paymentIds);
      for (const p of (pays ?? []) as { id: string; status: string }[])
        statusByPaymentId.set(p.id, p.status);
    }

    // nome do tenant só é necessário para super admin (a igreja já sabe quem é)
    const tenantNameById = new Map<string, string>();
    if (access.isPlatformAdmin) {
      const tenantIds = [...new Set(list.map((r) => r.tenant_id))];
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabaseAdmin
          .from("tenants")
          .select("id, name")
          .in("id", tenantIds);
        for (const t of (tenants ?? []) as { id: string; name: string }[])
          tenantNameById.set(t.id, t.name);
      }
    }

    const items: DonationListItem[] = list.map((r) => ({
      id: r.id,
      donorName: r.donor_name,
      tenantId: r.tenant_id,
      tenantName: access.isPlatformAdmin ? (tenantNameById.get(r.tenant_id) ?? null) : null,
      paymentMethod: r.payment_method,
      cardBrand: r.card_brand,
      amountCents: access.isPlatformAdmin ? (r.gross_amount ?? 0) : (r.net_amount ?? 0),
      status: r.payment_id ? (statusByPaymentId.get(r.payment_id) ?? null) : null,
      createdAt: r.created_at,
    }));

    return { items, isPlatformAdmin: access.isPlatformAdmin };
  });

type BillingAddress = { line1: string; city: string; state: string; zipCode: string } | null;

function extractBillingAddress(gatewayRequest: unknown): BillingAddress {
  if (!gatewayRequest || typeof gatewayRequest !== "object") return null;
  // payload enviado ao Pagar.me: customer.address ou billing_address, conforme o fluxo (cartão/boleto)
  const req = gatewayRequest as Record<string, unknown>;
  const addr =
    (req.billing_address as Record<string, unknown> | undefined) ??
    ((req.customer as Record<string, unknown> | undefined)?.address as
      | Record<string, unknown>
      | undefined);
  if (!addr) return null;
  const line1 = [addr.line_1, addr.line1].find((v) => typeof v === "string") as string | undefined;
  const city = addr.city as string | undefined;
  const state = addr.state as string | undefined;
  const zip = [addr.zip_code, addr.zipCode].find((v) => typeof v === "string") as
    | string
    | undefined;
  if (!line1 && !city && !zip) return null;
  return { line1: line1 ?? "", city: city ?? "", state: state ?? "", zipCode: zip ?? "" };
}

export type DonationDetail = {
  id: string;
  donorName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  tenantId: string;
  tenantName: string | null;
  paymentMethod: string | null;
  cardBrand: string | null;
  grossAmountCents: number | null;
  netAmountCents: number | null;
  adminFeeCents: number | null;
  status: string | null;
  gatewayId: string | null;
  createdAt: string;
  updatedAt: string | null;
  billingAddress: BillingAddress;
  isPlatformAdmin: boolean;
};

export const getDonationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { donationId: string }) =>
    z.object({ donationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const access = await resolveAccess(ctx);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("donations_staff" as never)
      .select(
        "id, tenant_id, donor_name, donor_email, donor_phone, payment_method, card_brand, gross_amount, admin_fee, net_amount, gateway_id, created_at, payment_id",
      )
      .eq("id", data.donationId);
    if (!access.isPlatformAdmin) query = query.eq("tenant_id", access.tenantId as string);

    type Row = {
      id: string;
      tenant_id: string;
      donor_name: string | null;
      donor_email: string | null;
      donor_phone: string | null;
      payment_method: string | null;
      card_brand: string | null;
      gross_amount: number | null;
      admin_fee: number | null;
      net_amount: number | null;
      gateway_id: string | null;
      created_at: string;
      payment_id: string | null;
    };
    const { data: row, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Doação não encontrada.");
    const r = row as Row;

    let status: string | null = null;
    let updatedAt: string | null = null;
    let billingAddress: BillingAddress = null;
    if (r.payment_id) {
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("status, updated_at, gateway_request")
        .eq("id", r.payment_id)
        .maybeSingle();
      if (payment) {
        status = (payment as { status: string }).status;
        updatedAt = (payment as { updated_at: string | null }).updated_at;
        billingAddress = extractBillingAddress(
          (payment as { gateway_request: unknown }).gateway_request,
        );
      }
    }

    let tenantName: string | null = null;
    if (access.isPlatformAdmin) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", r.tenant_id)
        .maybeSingle();
      tenantName = (tenant as { name: string } | null)?.name ?? null;
    }

    const detail: DonationDetail = {
      id: r.id,
      donorName: r.donor_name,
      donorEmail: r.donor_email,
      donorPhone: r.donor_phone,
      tenantId: r.tenant_id,
      tenantName,
      paymentMethod: r.payment_method,
      cardBrand: r.card_brand,
      grossAmountCents: access.isPlatformAdmin ? r.gross_amount : null,
      netAmountCents: r.net_amount,
      adminFeeCents: access.isPlatformAdmin ? r.admin_fee : null,
      status,
      gatewayId: r.gateway_id,
      createdAt: r.created_at,
      updatedAt,
      billingAddress,
      isPlatformAdmin: access.isPlatformAdmin,
    };
    return detail;
  });

export type TenantOption = { id: string; name: string };

/** Lista de instituições para o filtro do super admin. */
export const getTenantOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const access = await resolveAccess(ctx);
    if (!access.isPlatformAdmin) return { items: [] as TenantOption[], isPlatformAdmin: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as TenantOption[], isPlatformAdmin: true };
  });
