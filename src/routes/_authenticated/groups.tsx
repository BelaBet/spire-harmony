import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

type Group = { id: string; name: string; description: string | null; created_at: string };

function GroupsPage() {
  const { isStaff, profile, user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups((data ?? []) as Group[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    const { error } = await supabase.from("groups").insert({
      tenant_id: profile.tenant_id,
      name,
      description: description || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Grupo criado");
    setName(""); setDescription(""); setShowForm(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Grupos</h1>
          <p className="text-sm text-muted-foreground">Comunidades dentro do seu tenant</p>
        </div>
        {isStaff && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Novo grupo
          </Button>
        )}
      </div>

      {showForm && isStaff && (
        <Card className="p-4">
          <form onSubmit={createGroup} className="space-y-3">
            <Input placeholder="Nome do grupo" value={name} onChange={(e) => setName(e.target.value)} required />
            <Textarea placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Button type="submit">Criar</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum grupo ainda.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }}>
              <Card className="p-4 hover:border-primary transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{g.name}</h3>
                    {g.description && <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
