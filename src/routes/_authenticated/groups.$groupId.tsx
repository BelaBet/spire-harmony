import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, UserPlus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetail,
});

type Member = { id: string; profile_id: string; added_at: string; profile?: { full_name: string | null; email: string | null } };
type Profile = { id: string; full_name: string | null; email: string | null };
type Message = { id: string; content: string; created_at: string; sender_id: string | null };

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { isStaff, profile } = useAuth();
  const [group, setGroup] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");

  const load = async () => {
    const { data: g } = await supabase.from("groups").select("id,name,description").eq("id", groupId).maybeSingle();
    setGroup(g);
    const { data: m } = await supabase
      .from("group_members")
      .select("id, profile_id, added_at, profile:profiles(full_name, email)")
      .eq("group_id", groupId);
    setMembers((m ?? []) as never);
    if (isStaff) {
      const { data: p } = await supabase.from("profiles").select("id, full_name, email");
      setAllProfiles((p ?? []) as Profile[]);
    }
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, content, created_at, sender_id")
      .eq("target_type", "group")
      .eq("target_id", groupId)
      .order("created_at", { ascending: true });
    setMessages((msgs ?? []) as Message[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `target_id=eq.${groupId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const addMember = async () => {
    if (!selectedProfile) return;
    const { error } = await supabase.from("group_members").insert({ group_id: groupId, profile_id: selectedProfile });
    if (error) { toast.error(error.message); return; }
    toast.success("Membro adicionado");
    setSelectedProfile("");
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("group_members").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !profile?.tenant_id) return;
    const { error } = await supabase.from("messages").insert({
      tenant_id: profile.tenant_id,
      sender_id: profile.id,
      channel: "in_app",
      target_type: "group",
      target_id: groupId,
      content: newMsg,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    // notify members
    const memberIds = members.map((m) => m.profile_id);
    if (memberIds.length > 0 && isStaff) {
      await supabase.from("notifications").insert(
        memberIds.map((pid) => ({
          tenant_id: profile.tenant_id,
          profile_id: pid,
          title: `Nova mensagem em ${group?.name ?? "grupo"}`,
          body: newMsg.slice(0, 120),
          type: "group_message",
        }))
      );
    }
    setNewMsg("");
  };

  if (!group) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Link to="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <h1 className="font-display text-3xl">{group.name}</h1>
        {group.description && <p className="text-muted-foreground">{group.description}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <h2 className="font-medium">Membros ({members.length})</h2>
          {isStaff && (
            <div className="flex gap-2">
              <select className="flex-1 rounded-md border bg-background px-2 py-2 text-sm"
                value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
                <option value="">Selecione um membro</option>
                {allProfiles.filter((p) => !members.some((m) => m.profile_id === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
              <Button onClick={addMember} size="sm"><UserPlus className="h-4 w-4" /></Button>
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2">
                <span>{m.profile?.full_name ?? m.profile?.email ?? "Membro"}</span>
                {isStaff && (
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 space-y-3 flex flex-col">
          <h2 className="font-medium">Mensagens</h2>
          <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto space-y-2 rounded bg-muted/30 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem mensagens ainda.</p>
            ) : messages.map((m) => (
              <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.sender_id === profile?.id ? "bg-primary text-primary-foreground ml-8" : "bg-card mr-8"}`}>
                <p>{m.content}</p>
                <p className="mt-1 text-xs opacity-70">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
          {isStaff && (
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input placeholder="Mensagem..." value={newMsg} onChange={(e) => setNewMsg(e.target.value)} />
              <Button type="submit"><Send className="h-4 w-4" /></Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
