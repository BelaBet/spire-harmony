export const brl = (cents: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    ((cents ?? 0) as number) / 100,
  );

export const STATUS_PT: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  confirmed: "Pago",
  transferred: "Transferido",
  processing: "Processando",
  failed: "Falhou",
  canceled: "Cancelado",
  refused: "Recusado",
  refunded: "Reembolsado",
};
export const translateStatus = (s: string | null | undefined) => STATUS_PT[s ?? ""] ?? s ?? "—";

export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const METHOD_PT: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
};
export const translateMethod = (m: string | null | undefined) => METHOD_PT[m ?? ""] ?? m ?? "—";
