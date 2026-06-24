import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/financeiro/StatusBadge";
import { brl, fmtDateTime, translateMethod } from "@/components/financeiro/format";
import { getDonationDetail } from "@/lib/donations.functions";
import { CreditCard, QrCode, FileText } from "lucide-react";

type Props = {
  donationId: string | null;
  onClose: () => void;
};

function methodIcon(method: string | null) {
  if (method === "pix") return QrCode;
  if (method === "boleto") return FileText;
  return CreditCard;
}

export function DonationDetailDialog({ donationId, onClose }: Props) {
  const detailFn = useServerFn(getDonationDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["donation-detail", donationId],
    queryFn: () => detailFn({ data: { donationId: donationId as string } }),
    enabled: !!donationId,
  });

  const Icon = methodIcon(data?.paymentMethod ?? null);

  return (
    <Dialog open={!!donationId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Detalhes da doação</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar a doação."}
          </p>
        )}

        {data && (
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {data.isPlatformAdmin ? "Valor bruto" : "Valor recebido"}
                    </p>
                    <p className="font-display mt-1 text-3xl leading-none">
                      {brl(data.isPlatformAdmin ? data.grossAmountCents : data.netAmountCents)}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {fmtDateTime(data.createdAt)}
                      {data.isPlatformAdmin && data.tenantName ? ` · ${data.tenantName}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={data.status} />
                </div>

                {data.isPlatformAdmin && (
                  <div className="mt-4 flex gap-6 border-t pt-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Taxa administrativa</p>
                      <p className="text-sm font-medium text-amber-700">
                        − {brl(data.adminFeeCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Líquido p/ instituição</p>
                      <p className="text-sm font-medium text-emerald-700">
                        {brl(data.netAmountCents)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-card p-5 text-sm">
                <div className="flex justify-between border-b pb-3">
                  <span className="text-muted-foreground">Nome do doador</span>
                  <span className="font-medium">{data.donorName ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b py-3">
                  <span className="text-muted-foreground">E-mail</span>
                  <span>{data.donorEmail ?? "—"}</span>
                </div>
                <div className="flex justify-between pt-3">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{data.donorPhone ?? "—"}</span>
                </div>
                {data.billingAddress && (
                  <div className="flex justify-between border-t pt-3 mt-3">
                    <span className="text-muted-foreground">Endereço</span>
                    <span className="max-w-[60%] text-right">
                      {[
                        data.billingAddress.line1,
                        data.billingAddress.city,
                        data.billingAddress.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      {data.billingAddress.zipCode ? ` · CEP ${data.billingAddress.zipCode}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="mb-3 font-medium">Dados do pedido</p>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[11px] text-muted-foreground">ID</p>
                    <p className="font-mono text-xs">{data.gatewayId ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Atualizado em</p>
                    <p className="text-xs">{fmtDateTime(data.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Criado em</p>
                    <p className="text-xs">{fmtDateTime(data.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="mb-3 font-medium">Forma de pagamento</p>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <div>
                    <p>{translateMethod(data.paymentMethod)}</p>
                    {data.cardBrand && (
                      <p className="text-xs text-muted-foreground">{data.cardBrand}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
