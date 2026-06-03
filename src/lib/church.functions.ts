import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LogoSchema = z
  .object({
    base64: z.string().min(1).max(8_000_000), // ~6MB image
    contentType: z.string().regex(/^image\/(png|jpe?g|webp|svg\+xml)$/, "Tipo de imagem inválido"),
    filename: z.string().min(1).max(120),
  })
  .optional();

const InputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(200).optional().default(""),
  logo: LogoSchema,
});

export const updateChurchIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !prof?.tenant_id) {
      throw new Error("Perfil ou igreja não encontrados para este usuário.");
    }
    const tenantId = prof.tenant_id as string;

    let logoUrl: string | null = null;
    if (data.logo) {
      const ext = (data.logo.filename.split(".").pop() || "png").toLowerCase().replace("jpeg", "jpg");
      const path = `${tenantId}/logo-${Date.now()}.${ext}`;
      const buffer = Buffer.from(data.logo.base64, "base64");
      const { error: uErr } = await supabaseAdmin.storage
        .from("tenant-logos")
        .upload(path, buffer, { contentType: data.logo.contentType, upsert: true });
      if (uErr) throw new Error(`Falha ao enviar a logo: ${uErr.message}`);
      const { data: pub } = supabaseAdmin.storage.from("tenant-logos").getPublicUrl(path);
      logoUrl = pub.publicUrl;
    }

    const update: { name: string; tagline?: string; logo_url?: string } = { name: data.name };
    if (data.tagline !== undefined) update.tagline = data.tagline;
    if (logoUrl) update.logo_url = logoUrl;

    const { error: tErr } = await supabaseAdmin.from("tenants").update(update).eq("id", tenantId);
    if (tErr) throw new Error(`Não foi possível atualizar a igreja: ${tErr.message}`);

    // Promove o usuário a admin do tenant para futuras edições via cliente.
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, tenant_id: tenantId, role: "admin" },
        { onConflict: "user_id,tenant_id,role" },
      );

    return { tenantId, logoUrl };
  });
