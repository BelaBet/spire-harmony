// Gate financeiro: bloqueia PIX, cartão, boleto, antecipação e transferências
// enquanto o tenant não estiver com cadastro 100% aprovado.
// Use APENAS em server functions / server routes (chama supabaseAdmin).

export async function assertFinancialActive(tenantId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("financial_active, compliance_status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao verificar compliance: ${error.message}`);
  if (!data) throw new Error("Igreja não encontrada.");
  const row = data as { financial_active: boolean; compliance_status: string };
  if (!row.financial_active) {
    throw new Error(
      `Operação financeira indisponível: cadastro pendente (${row.compliance_status}). ` +
        "Finalize as pendências de cadastro para ativar pagamentos.",
    );
  }
}
