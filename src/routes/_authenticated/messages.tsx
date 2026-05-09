import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

type Group = { id: string; name: string };

function MessagesPage() {
  const { isStaff, profile } = useAuth();
  const [channel, setChannel] = useState<"in_app" | "sms" | "whatsapp">("in_app");
  const [target, setTarget] = useState<"broadcast" | "group">("broadcast");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    supabase.from("groups").select("id, name").then(({ data }) => setGroups((data ?? []) as Group[]));
  }, [isStaff]);

  if (!isStaff) {
    return <Card className="p-8 text-center text-muted-foreground">Acesso restrito à equipe.</Card>;
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    setSending(true);
    try {
      const targetId = target === "group" ? groupId : null;
      const { error: msgErr } = await supabase.from("messages").insert({
        tenant_id: profile.tenant_id,
        sender_id: profile.id,
        channel,
        target_type: target,
        target_id: targetId,
        content,
        status: channel === "in_app" ? "sent" : "queued",
        sent_at: channel === "in_app" ? new Date().toISOString() : null,
      });
      if (msgErr) throw msgErr;

      if (channel === "in_app") {
        let recipientIds: string[] = [];
        if (target === "broadcast") {
          const { data } = await supabase.from("profiles").select("id").eq("tenant_id", profile.tenant_id);
          recipientIds = (data ?? []).map((p) => p.id);
        } else if (target === "group" && groupId) {
          const { data } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
          recipientIds = (data ?? []).map((p) => p.profile_id);
        }
        if (recipientIds.length > 0) {
          await supabase.from("notifications").insert(
            recipientIds.map((pid) => ({
              tenant_id: profile.tenant_id,
              profile_id: pid,
              title: title || "Nova mensagem",
              body: content.slice(0, 200),
              type: "broadcast",
            }))
          );
        }
        toast.success(`Enviado para ${recipientIds.length} pessoa(s)`);
      } else {
        toast.success(`Mensagem enfileirada (${channel}). Integração em breve.`);
      }
      setTitle(""); setContent("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Mensagens</h1>
        <p className="text-sm text-muted-foreground">Envie comunicados para sua comunidade</p>
      </div>

      <Card className="p-6">
        <form onSubmit={send} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Canal</label>
              <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="in_app">In-app</option>
                <option value="sms">SMS (em breve)</option>
                <option value="whatsapp">WhatsApp (em breve)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Destinatários</label>
              <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
                <option value="broadcast">Toda a comunidade</option>
                <option value="group">Grupo específico</option>
              </select>
            </div>
          </div>

          {target === "group" && (
            <div>
              <label className="text-sm font-medium">Grupo</label>
              <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
                <option value="">Selecione</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {channel === "in_app" && (
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Culto especial" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Mensagem</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={5} />
          </div>

          <Button type="submit" disabled={sending}>
            <Megaphone className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
