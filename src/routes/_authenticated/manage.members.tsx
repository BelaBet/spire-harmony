import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Search, UserCheck, UserX, Users, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/manage/members")({
  component: MembersPage,
});

type Profile = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  status: "pending" | "approved" | "blocked"; created_at: string; tenant_id: string;
};
type Donation = { profile_id: string; amount: number; created_at: string };
type Group = { id: string; name: string };

function MembersPage() {
  const { profile: me } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [groupMembers, setGroupMembers] = useState<{ group_id: string; profile_id: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const [bulkMsgOpen, setBulkMsgOpen] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkMsgTitle, setBulkMsgTitle] = useState("");
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: ps }, { data: ds }, { data: gs }, { data: gms }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, status, created_at, tenant_id"),
      supabase.from("donations").select("profile_id, amount, created_at"),
      supabase.from("groups").select("id, name"),
      supabase.from("group_members").select("group_id, profile_id"),
    ]);
    setMembers((ps ?? []) as Profile[]);
    setDonations((ds ?? []) as Donation[]);
    setGroups((gs ?? []) as Group[]);
    setGroupMembers((gms ?? []) as never);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalsByMember = useMemo(() => {
    const m = new Map<string, number>();
    donations.forEach((d) => m.set(d.profile_id, (m.get(d.profile_id) ?? 0) + Number(d.amount || 0)));
    return m;
  }, [donations]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (groupFilter !== "all" && !groupMembers.some((gm) => gm.group_id === groupFilter && gm.profile_id === m.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${m.full_name ?? ""} ${m.email ?? ""} ${m.phone ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [members, statusFilter, groupFilter, groupMembers, search]);

  const toggleAll = (v: boolean) => setSelected(v ? new Set(filtered.map((m) => m.id)) : new Set());
  const toggleOne = (id: string, v: boolean) => {
    const s = new Set(selected);
    if (v) s.add(id); else s.delete(id);
    setSelected(s);
  };

  const updateStatus = async (ids: string[], status: Profile["status"]) => {
    const { error } = await supabase.from("profiles").update({ status }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} atualizado(s)`);
    setSelected(new Set());
    load();
  };

  const bulkAddToGroup = async () => {
    if (!targetGroupId || selected.size === 0) return;
    const rows = Array.from(selected).map((pid) => ({ group_id: targetGroupId, profile_id: pid }));
    const { error } = await supabase.from("group_members").upsert(rows, { onConflict: "group_id,profile_id", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    toast.success(`${selected.size} adicionado(s) ao grupo`);
    setAddToGroupOpen(false);
    setSelected(new Set());
    load();
  };

  const sendBulkMessage = async () => {
    if (!bulkMsg.trim() || !me?.tenant_id || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error: mErr } = await supabase.from("messages").insert({
      tenant_id: me.tenant_id, sender_id: me.id, channel: "in_app",
      target_type: "individual", target_id: null,
      content: bulkMsg, status: "sent", sent_at: new Date().toISOString(),
    });
    if (mErr) return toast.error(mErr.message);
    const { error: nErr } = await supabase.from("notifications").insert(
      ids.map((pid) => ({
        tenant_id: me.tenant_id, profile_id: pid,
        title: bulkMsgTitle || "Mensagem da gestão",
        body: bulkMsg.slice(0, 200), type: "direct",
      }))
    );
    if (nErr) return toast.error(nErr.message);
    toast.success(`Enviado para ${ids.length}`);
    setBulkMsgOpen(false); setBulkMsg(""); setBulkMsgTitle(""); setSelected(new Set());
  };

  const detailMember = members.find((m) => m.id === detailId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Membros</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua comunidade</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nome, email, telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="rounded-md border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="blocked">Bloqueado</option>
          </select>
          <select className="rounded-md border bg-background px-3 py-2 text-sm" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="all">Todos os grupos</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2 rounded bg-muted/40 p-2 text-sm">
            <span className="self-center">{selected.size} selecionado(s)</span>
            <Button size="sm" variant="outline" onClick={() => updateStatus(Array.from(selected), "approved")}>
              <UserCheck className="h-4 w-4" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus(Array.from(selected), "blocked")}>
              <UserX className="h-4 w-4" /> Bloquear
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddToGroupOpen(true)}>
              <Users className="h-4 w-4" /> Adicionar ao grupo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkMsgOpen(true)}>
              <Send className="h-4 w-4" /> Enviar mensagem
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={(v) => toggleAll(v === true)} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrou em</TableHead>
                <TableHead>Doado</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum membro encontrado</TableCell></TableRow>
              ) : filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><Checkbox checked={selected.has(m.id)} onCheckedChange={(v) => toggleOne(m.id, v === true)} /></TableCell>
                  <TableCell className="font-medium">{m.full_name ?? "—"}</TableCell>
                  <TableCell>{m.phone ?? "—"}</TableCell>
                  <TableCell>{m.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "approved" ? "default" : m.status === "pending" ? "secondary" : "destructive"}>
                      {m.status === "approved" ? "Aprovado" : m.status === "pending" ? "Pendente" : "Bloqueado"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(m.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{(totalsByMember.get(m.id) ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailId(m.id)}>
                          <Eye className="h-4 w-4" /> Ver perfil
                        </DropdownMenuItem>
                        {m.status !== "approved" && (
                          <DropdownMenuItem onClick={() => updateStatus([m.id], "approved")}>
                            <UserCheck className="h-4 w-4" /> Aprovar
                          </DropdownMenuItem>
                        )}
                        {m.status !== "blocked" && (
                          <DropdownMenuItem onClick={() => updateStatus([m.id], "blocked")}>
                            <UserX className="h-4 w-4" /> Bloquear
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setSelected(new Set([m.id])); setAddToGroupOpen(true); }}>
                          <Users className="h-4 w-4" /> Adicionar ao grupo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <MemberDetailDialog
        open={!!detailMember}
        onOpenChange={(v) => !v && setDetailId(null)}
        member={detailMember ?? null}
        donations={donations.filter((d) => d.profile_id === detailId)}
      />

      <Dialog open={addToGroupOpen} onOpenChange={setAddToGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar ao grupo</DialogTitle></DialogHeader>
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
            <option value="">Selecione um grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Button onClick={bulkAddToGroup} disabled={!targetGroupId}>Adicionar {selected.size}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMsgOpen} onOpenChange={setBulkMsgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar mensagem</DialogTitle></DialogHeader>
          <Input placeholder="Título" value={bulkMsgTitle} onChange={(e) => setBulkMsgTitle(e.target.value)} />
          <textarea className="min-h-[120px] w-full rounded-md border bg-background p-2 text-sm" placeholder="Mensagem..." value={bulkMsg} onChange={(e) => setBulkMsg(e.target.value)} />
          <Button onClick={sendBulkMessage}>Enviar para {selected.size}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberDetailDialog({
  open, onOpenChange, member, donations,
}: { open: boolean; onOpenChange: (v: boolean) => void; member: Profile | null; donations: Donation[] }) {
  const [tickets, setTickets] = useState<{ id: string; status: string; created_at: string; event?: { title: string } | null }[]>([]);
  const [notifs, setNotifs] = useState<{ id: string; title: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!member) return;
    (async () => {
      const [{ data: t }, { data: n }] = await Promise.all([
        supabase.from("tickets").select("id, status, created_at, event:events(title)").eq("profile_id", member.id).order("created_at", { ascending: false }),
        supabase.from("notifications").select("id, title, created_at").eq("profile_id", member.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setTickets((t ?? []) as never);
      setNotifs((n ?? []) as never);
    })();
  }, [member]);

  if (!member) return null;
  const total = donations.reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member.full_name ?? "Membro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="E-mail" value={member.email ?? "—"} />
            <Info label="Telefone" value={member.phone ?? "—"} />
            <Info label="Status" value={member.status} />
            <Info label="Entrou em" value={format(new Date(member.created_at), "dd/MM/yyyy")} />
          </div>

          <div>
            <h3 className="mb-2 font-medium">Doações ({donations.length}) — Total {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</h3>
            {donations.length === 0 ? <p className="text-muted-foreground">Sem doações.</p> : (
              <ul className="space-y-1">
                {donations.slice(0, 10).map((d, i) => (
                  <li key={i} className="flex justify-between rounded bg-muted/40 px-2 py-1">
                    <span>{format(new Date(d.created_at), "dd/MM/yyyy")}</span>
                    <span>{Number(d.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-medium">Ingressos ({tickets.length})</h3>
            {tickets.length === 0 ? <p className="text-muted-foreground">Sem ingressos.</p> : (
              <ul className="space-y-1">
                {tickets.map((t) => (
                  <li key={t.id} className="flex justify-between rounded bg-muted/40 px-2 py-1">
                    <span>{t.event?.title ?? "Evento"}</span>
                    <span className="text-muted-foreground">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-medium">Mensagens recebidas ({notifs.length})</h3>
            {notifs.length === 0 ? <p className="text-muted-foreground">Sem mensagens.</p> : (
              <ul className="space-y-1">
                {notifs.map((n) => (
                  <li key={n.id} className="flex justify-between rounded bg-muted/40 px-2 py-1">
                    <span>{n.title}</span>
                    <span className="text-muted-foreground">{format(new Date(n.created_at), "dd/MM")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
