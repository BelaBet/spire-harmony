import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Meu perfil" }] }),
});

function ProfilePage() {
  const { profile, refresh, signOut, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado.");
    refresh();
  };

  const exportData = async () => {
    const tables = ["profiles", "tickets", "payments", "donations", "notifications"] as const;
    const out: Record<string, unknown> = {};
    for (const t of tables) {
      const { data } = await supabase.from(t).select("*");
      out[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "meus-dados.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados.");
  };

  const anonymize = async () => {
    if (!confirm("Tem certeza? Seus dados pessoais serão anonimizados e não poderão ser restaurados.")) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: "Membro anônimo", phone: null, email: null, avatar_url: null })
      .eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Dados anonimizados.");
    await signOut();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl md:text-4xl">Meu perfil</h1>
      <p className="mt-1 text-muted-foreground">Gerencie seus dados e privacidade.</p>

      <div className="mt-8 space-y-4 rounded-2xl border bg-card p-6">
        <div>
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-xl">Privacidade · LGPD</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Você tem direito de acessar, exportar e solicitar a anonimização dos seus dados.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4" /> Exportar meus dados
          </Button>
          <Button variant="destructive" onClick={anonymize}>
            <ShieldAlert className="h-4 w-4" /> Anonimizar minha conta
          </Button>
        </div>
      </div>
    </div>
  );
}
