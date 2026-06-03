import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";
import { z } from "zod";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Criar conta" }] }),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "Telefone inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres").max(72),
});

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.replace(/(\d{0,2})/, "($1");
  if (d.length <= 7) return d.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function SignupPage() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return toast.error("Você precisa aceitar os termos LGPD.");
    const parsed = signupSchema.safeParse({ fullName, email, phone, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: fullName,
          phone,
          tenant_slug: tenant?.slug ?? "default",
          lgpd_consent: true,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(translateError(error));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl">✉</div>
          <h1 className="font-display text-2xl">Verifique seu e-mail</h1>
          <p className="mt-3 text-muted-foreground">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Clique no link para validar sua conta.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Após confirmar seu e-mail, faça login para iniciar o onboarding de <strong>{tenant?.name ?? "sua comunidade"}</strong>.
          </p>
          <Button asChild className="mt-6" variant="outline"><Link to="/login">Voltar ao login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 block text-sm text-muted-foreground hover:underline">← Voltar</Link>
        <h1 className="font-display text-3xl">Junte-se a {tenant?.name ?? "nós"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Crie sua conta de membro.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" maxLength={255} />
          </div>
          <div>
            <Label htmlFor="phone">Celular</Label>
            <Input id="phone" inputMode="tel" placeholder="(11) 99999-9999" value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))} required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" />
          </div>
          <label className="flex items-start gap-3 text-xs text-muted-foreground">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              Concordo com o tratamento dos meus dados pessoais conforme a{" "}
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" className="text-primary underline">LGPD</button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tratamento de dados (LGPD)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p><strong>Dados coletados:</strong> nome, e-mail, telefone, status de membro, participação em grupos e eventos, doações.</p>
                    <p><strong>Finalidade:</strong> gestão da comunidade, comunicação de eventos, controle de acesso e emissão de recibos.</p>
                    <p><strong>Base legal:</strong> consentimento (Art. 7º, I da Lei 13.709/2018).</p>
                    <p><strong>Compartilhamento:</strong> seus dados não são vendidos. Compartilhamos apenas com provedores essenciais (hospedagem, pagamentos).</p>
                    <p><strong>Seus direitos:</strong> a qualquer momento você pode acessar, exportar ou anonimizar seus dados na tela de Perfil.</p>
                  </div>
                </DialogContent>
              </Dialog>
              {" "}para fins de gestão da comunidade.
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}

void useNavigate;
