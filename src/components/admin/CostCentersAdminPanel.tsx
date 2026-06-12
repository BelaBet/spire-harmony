import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { QrCode, Info } from "lucide-react";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import {
  listCostCenters,
  toggleCostCenterActive,
} from "@/lib/cost-centers.functions";

export function CostCentersAdminPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listCostCenters);
  const toggleFn = useServerFn(toggleCostCenterActive);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["cost-centers", "my-tenant"],
    queryFn: () => list({ data: {} }),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost-centers", "my-tenant"] }),
    onError: (e) => toast.error(translateError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centros de custo</CardTitle>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          Para criar novos centros ou alterar taxas, fale com o suporte.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="text-right">QR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !rows?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum centro disponível.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                    <TableCell className="text-center text-xs">
                      {r.allows_installments ? `até ${r.max_installments}x` : "à vista"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.is_active}
                        disabled={toggleMut.isPending}
                        onCheckedChange={(v) => toggleMut.mutate({ id: r.id, isActive: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.qr_code_url ? (
                        <Button size="icon" variant="ghost" asChild aria-label="Baixar QR">
                          <a href={r.qr_code_url} download={`qr-${r.slug}.png`} target="_blank" rel="noreferrer">
                            <QrCode className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
