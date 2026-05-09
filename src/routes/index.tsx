import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, MapPin, Clock, Copy, Check, Sparkles } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Comunidade — Plataforma para sua congregação" },
      { name: "description", content: "Eventos, doações e comunidade conectados pela fé." },
    ],
  }),
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  ticket_price: number | null;
  status: string;
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Index() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const name = tenant?.name ?? "Comunidade";
  const tagline = (tenant as any)?.tagline ?? "Um lugar de fé, amor e comunidade";
  const primary = tenant?.primary_color ?? "#1a3a5c";
  const accent = (tenant as any)?.accent_color ?? "#C9993A";
  const pixKey = (tenant as any)?.pix_key ?? "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: events } = useQuery({
    queryKey: ["public-events", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("status", "active")
        .order("date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const copyPix = () => {
    if (!pixKey) return;
    navigator.clipboard?.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#fafaf7", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp .7s ease both; }
        .fade-up-2 { animation: fadeUp .7s .15s ease both; }
        .fade-up-3 { animation: fadeUp .7s .3s ease both; }
        .display { font-family: 'Playfair Display', Georgia, serif; }
        .event-card { transition: all .35s cubic-bezier(.34,1.56,.64,1); }
        .event-card:hover { transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,.18) !important; }
      `}</style>

      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
          transition: "all .3s ease",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={name} style={{ width: 32, height: 32, borderRadius: 999, objectFit: "cover" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: 999, background: primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
                {initials(name)}
              </div>
            )}
            <span style={{ fontWeight: 600, color: scrolled ? "#1a1a1a" : "transparent", transition: "color .3s" }}>{name}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {user ? (
              <Button asChild size="sm"><Link to="/dashboard">Painel</Link></Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost"><Link to="/login">Entrar</Link></Button>
                <Button asChild size="sm" style={{ background: primary, color: "#fff" }}><Link to="/signup">Cadastrar</Link></Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* HERO */}
      <section
        style={{
          position: "relative", padding: "80px 24px 100px", textAlign: "center",
          background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`,
          color: "#fff", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -120, right: -120, width: 320, height: 320, borderRadius: "50%", background: `${accent}22` }} />
        <div style={{ position: "absolute", bottom: -160, left: -160, width: 400, height: 400, borderRadius: "50%", background: `${accent}18` }} />

        <div className="fade-up" style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={name} style={{ width: 96, height: 96, borderRadius: 999, objectFit: "cover", margin: "0 auto 24px", border: `3px solid ${accent}` }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 999, background: "#fff", color: primary, display: "grid", placeItems: "center", fontSize: 32, fontWeight: 800, margin: "0 auto 24px", border: `3px solid ${accent}` }}>
              {initials(name)}
            </div>
          )}

          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)", lineHeight: 1.1, margin: "0 0 16px" }}>
            {name}
          </h1>
          <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)", opacity: 0.9, margin: 0, fontWeight: 300 }}>
            {tagline}
          </p>

          <div style={{ width: 60, height: 3, background: accent, margin: "32px auto 0", borderRadius: 2 }} />
        </div>
      </section>

      {/* DONATION */}
      {pixKey && (
        <section style={{ padding: "80px 24px", maxWidth: 720, margin: "0 auto" }}>
          <div className="fade-up" style={{ textAlign: "center", marginBottom: 40 }}>
            <span style={{ fontSize: 12, letterSpacing: 3, color: accent, fontWeight: 600 }}>✦ CONTRIBUA COM A OBRA</span>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: "12px 0 8px", color: primary }}>
              Faça sua doação via PIX
            </h2>
            <p style={{ color: "#666", margin: 0 }}>
              Escaneie o QR Code ou copie a chave abaixo. Toda doação é recebida com gratidão.
            </p>
          </div>

          <div className="fade-up-2" style={{ background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${primary}, ${accent})` }} />

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 0 4px #22c55e22" }} />
              <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>Chave PIX ativa</span>
            </div>

            <div style={{ display: "grid", placeItems: "center", marginBottom: 24 }}>
              <div style={{ padding: 16, background: "#fff", border: `2px solid ${primary}11`, borderRadius: 16 }}>
                <QRCodeSVG value={pixKey} size={180} fgColor={primary} bgColor="#fff" level="M" />
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ fontSize: 11, letterSpacing: 2, color: "#999", margin: "0 0 4px" }}>BENEFICIÁRIO</p>
              <p className="display" style={{ fontSize: 18, color: primary, margin: 0 }}>{name}</p>
            </div>

            <div style={{ height: 1, background: "#eee", margin: "24px 0" }} />

            <div>
              <p style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Chave PIX</p>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <div style={{ flex: 1, padding: "12px 16px", background: "#f5f5f0", borderRadius: 10, fontFamily: "monospace", fontSize: 14, display: "flex", alignItems: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pixKey}
                </div>
                <button
                  onClick={copyPix}
                  style={{
                    padding: "0 18px", border: `2px solid ${primary}`, background: copied ? primary : "transparent",
                    color: copied ? "#fff" : primary, borderRadius: 10, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6, transition: "all .2s",
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: `${accent}11`, borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20 }}>🙏</span>
              <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5 }}>
                Após sua doação, você pode receber a confirmação no WhatsApp ou e-mail cadastrado.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* EVENTS */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="fade-up" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 12, letterSpacing: 3, color: accent, fontWeight: 600 }}>✦ AGENDA</span>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", margin: "12px 0 8px", color: primary }}>
              Próximos Eventos
            </h2>
            <p style={{ color: "#666", margin: 0 }}>Clique em qualquer evento para garantir sua participação.</p>
          </div>

          {(events?.length ?? 0) === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#999", border: "2px dashed #eee", borderRadius: 16 }}>
              <Sparkles style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: 0 }}>Nenhum evento publicado ainda.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {events!.map((e) => {
                const dt = e.date ? new Date(e.date) : null;
                const day = dt?.getDate();
                const month = dt?.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
                const isFree = !e.ticket_price || Number(e.ticket_price) === 0;
                return (
                  <Link
                    key={e.id}
                    to={user ? "/events/$eventId" : "/login"}
                    params={user ? { eventId: e.id } : undefined as any}
                    className="event-card"
                    style={{
                      display: "flex", flexDirection: "column", background: "#fff",
                      borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                      textDecoration: "none", color: "inherit", border: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ position: "relative", height: 180, background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)` }}>
                      <div style={{ position: "absolute", top: 12, right: 12, padding: "6px 12px", background: "rgba(255,255,255,0.95)", color: primary, borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                        {isFree ? "GRATUITO" : `R$ ${Number(e.ticket_price).toFixed(2)}`}
                      </div>
                      {dt && (
                        <div style={{ position: "absolute", bottom: 12, left: 12, background: "#fff", borderRadius: 12, padding: "8px 12px", textAlign: "center", minWidth: 56, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                          <div className="display" style={{ fontSize: 22, color: primary, lineHeight: 1, fontWeight: 800 }}>{day}</div>
                          <div style={{ fontSize: 10, color: "#666", letterSpacing: 1, marginTop: 2 }}>{month}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
                      <h3 className="display" style={{ fontSize: 20, margin: "0 0 12px", color: primary }}>{e.title}</h3>
                      {dt && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 13, marginBottom: 6 }}>
                          <Clock size={14} /> {formatTime(e.date!)} · {formatDate(e.date!)}
                        </div>
                      )}
                      {e.location && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 13, marginBottom: 12 }}>
                          <MapPin size={14} /> {e.location}
                        </div>
                      )}
                      {e.description && (
                        <p style={{ color: "#555", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px", flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {e.description}
                        </p>
                      )}
                      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f0f0f0", color: accent, fontWeight: 600, fontSize: 14 }}>
                        {isFree ? "Confirmar Presença →" : "Comprar Ingresso →"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "48px 24px", textAlign: "center", background: "#fafaf7", borderTop: "1px solid #eee" }}>
        <div style={{ width: 48, height: 48, borderRadius: 999, background: primary, color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 12px", fontWeight: 700 }}>
          {initials(name)}
        </div>
        <p className="display" style={{ fontSize: 16, color: primary, margin: "0 0 8px" }}>{name}</p>
        <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
          © {new Date().getFullYear()} · Dados protegidos conforme a LGPD.
        </p>
      </footer>
    </div>
  );
}
