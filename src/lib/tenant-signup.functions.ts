import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  church_name: z.string().trim().min(2).max(120),
  document: z.string().trim().min(11).max(20),
  document_type: z.enum(["cnpj", "cpf"]),
});

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

/**
 * Reserva um novo tenant antes do auth.signUp.
 * Retorna o tenant_id para ser enviado em raw_user_meta_data.
 * Falha se o documento já estiver em uso.
 */
export const reserveTenantForSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const onlyDigits = data.document.replace(/\D/g, "");

    // Documento já cadastrado?
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("document", onlyDigits)
      .is("deleted_at", null)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing) {
      throw new Error(
        "Esta instituição já está cadastrada. Peça um convite ao administrador.",
      );
    }

    // Slug único
    const base = slugify(data.church_name) || `igreja-${Date.now()}`;
    let slug = base;
    for (let i = 1; i < 20; i++) {
      const { data: clash } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${i}`;
    }

    const { data: created, error: cErr } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.church_name,
        slug,
        document: onlyDigits,
        document_type: data.document_type,
        active: true,
      })
      .select("id")
      .single();
    if (cErr || !created) {
      throw new Error(cErr?.message || "Falha ao criar a instituição.");
    }

    return { tenant_id: created.id, slug };
  });
