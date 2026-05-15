import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  Barcode,
  CreditCard,
  MoreHorizontal,
  Copy,
  Check,
  Upload,
  Smartphone,
  Receipt,
  ArrowLeftRight,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: ChurchPage,
  head: () => ({
    meta: [
      { title: "Igreja Comunidade da Graça" },
      { name: "description", content: "Um lugar de fé, amor e comunidade." },
    ],
  }),
});

// ── Mock data (substituir por fetch do Supabase via tenant_id/slug) ──────────
const CHURCH = {
  name: "Igreja Comunidade da Graça",
  tagline: "Um lugar de fé, amor e comunidade",
  logo: null as string | null,
  primaryColor: "#1a3a5c",
  accentColor: "#C9993A",
  coverPhoto: null as string | null,
};

type EventItem = {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  image: string;
  ticketUrl: string;
  free: boolean;
  price?: string;
  spots: number;
};

const EVENTS: EventItem[] = [
  {
    id: 1,
    title: "Culto de Celebração",
    date: "2025-05-18",
    time: "18:00",
    location: "Templo Central, Caruaru - PE",
    description: "Uma noite especial de louvor, adoração e palavra. Venha com sua família!",
    image: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=600&q=80",
    ticketUrl: "https://bilheteria.exemplo.com/culto-celebracao",
    free: true,
    spots: 320,
  },
  {
    id: 2,
    title: "Conferência Jovem 2025",
    date: "2025-06-07",
    time: "09:00",
    location: "Centro de Convenções, Recife - PE",
    description: "Dois dias de imersão para jovens com pregações, workshops e muita música.",
    image: "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=600&q=80",
    ticketUrl: "https://bilheteria.exemplo.com/conf-jovem-2025",
    free: false,
    price: "R$ 45,00",
    spots: 180,
  },
  {
    id: 3,
    title: "Retiro Família",
    date: "2025-06-28",
    time: "08:00",
    location: "Sítio Recanto Verde, Gravatá - PE",
    description: "Um final de semana inteiro para restaurar laços familiares em plena natureza.",
    image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&q=80",
    ticketUrl: "https://bilheteria.exemplo.com/retiro-familia",
    free: false,
    price: "R$ 120,00",
    spots: 60,
  },
];

const PIX_KEY = "33.385.082/0001-99";

// ── Utility ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── QR Code SVG (mock visual — em produção usar qrcode.react) ─────────────
function QRCodeSVG({ size = 180, primary }: { size?: number; primary: string }) {
  const cells = 21;
  const cell = size / cells;
  const seed: [number, number][] = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
    [0, 1], [6, 1], [0, 2], [2, 2], [3, 2], [4, 2], [6, 2],
    [0, 3], [2, 3], [3, 3], [4, 3], [6, 3], [0, 4], [2, 4], [3, 4], [4, 4], [6, 4],
    [0, 5], [6, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
    [14, 0], [15, 0], [16, 0], [17, 0], [18, 0], [19, 0], [20, 0],
    [14, 1], [20, 1], [14, 2], [16, 2], [17, 2], [18, 2], [20, 2],
    [14, 3], [16, 3], [17, 3], [18, 3], [20, 3], [14, 4], [16, 4], [17, 4], [18, 4], [20, 4],
    [14, 5], [20, 5], [14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [19, 6], [20, 6],
    [0, 14], [1, 14], [2, 14], [3, 14], [4, 14], [5, 14], [6, 14],
    [0, 15], [6, 15], [0, 16], [2, 16], [3, 16], [4, 16], [6, 16],
    [0, 17], [2, 17], [3, 17], [4, 17], [6, 17], [0, 18], [2, 18], [3, 18], [4, 18], [6, 18],
    [0, 19], [6, 19], [0, 20], [1, 20], [2, 20], [3, 20], [4, 20], [5, 20], [6, 20],
  ];
  const extra: [number, number][] = [];
  for (let r = 8; r < 21; r++) {
    for (let c = 8; c < 21; c++) {
      if ((r + c * 3 + r * c) % 3 === 0) extra.push([c, r]);
    }
  }
  for (let r = 0; r < 7; r++) {
    for (let c = 8; c < 14; c++) {
      if ((r * 7 + c) % 2 === 0) extra.push([c, r]);
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <rect width={size} height={size} fill="#fff" />
      {[...seed, ...extra].map(([c, r], i) => (
        <rect key={i} x={c * cell} y={r * cell} width={cell} height={cell} fill={primary} />
      ))}
    </svg>
  );
}

// ── Payment Method Card (hover/animation matches EventCard) ─────────────────
function PaymentMethodCard({
  children,
  accent,
  primary,
  featured = false,
}: {
  children: React.ReactNode;
  accent: string;
  primary: string;
  featured?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  void accent;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        padding: 24,
        paddingTop: featured ? 28 : 24,
        boxShadow: hovered ? "0 20px 60px rgba(0,0,0,0.18)" : "0 4px 24px rgba(0,0,0,0.08)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        display: "flex",
        flexDirection: "column",
        border: featured ? `1px solid ${primary}15` : "1px solid #f0f0f0",
      }}
    >
      {children}
    </div>
  );
}

function PaymentHeader({
  primary,
  title,
  subtitle,
  icon,
}: {
  primary: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${primary}11`,
          color: primary,
          display: "grid",
          placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: primary, margin: 0 }}>
          {title}
        </h3>
        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{subtitle}</p>
      </div>
    </div>
  );
}

function PlaceholderBody({
  primary,
  accent,
  label,
  status,
  muted = false,
}: {
  primary: string;
  accent: string;
  label: string;
  status: string;
  muted?: boolean;
}) {
  return (
    <>
      <div
        style={{
          flex: 1,
          minHeight: 150,
          borderRadius: 14,
          background: muted
            ? "repeating-linear-gradient(135deg, #f7f7f2, #f7f7f2 10px, #fafaf7 10px, #fafaf7 20px)"
            : `linear-gradient(135deg, ${primary}08, ${accent}10)`,
          border: `1px dashed ${muted ? "#ddd" : primary + "22"}`,
          display: "grid",
          placeItems: "center",
          marginBottom: 16,
          color: muted ? "#999" : primary,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 0.3,
          textAlign: "center",
          padding: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: muted ? "#bbb" : accent, marginBottom: 6, fontWeight: 600 }}>
            {status.toUpperCase()}
          </div>
          {label}
        </div>
      </div>
      <button
        type="button"
        disabled={muted}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          border: muted ? "1px solid #e5e5e5" : `2px solid ${primary}`,
          background: muted ? "#f5f5f0" : "transparent",
          color: muted ? "#aaa" : primary,
          fontWeight: 600,
          fontSize: 14,
          cursor: muted ? "not-allowed" : "pointer",
          transition: "all .2s",
          marginTop: "auto",
        }}
        onMouseEnter={(e) => {
          if (muted) return;
          (e.currentTarget as HTMLButtonElement).style.background = primary;
          (e.currentTarget as HTMLButtonElement).style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          if (muted) return;
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = primary;
        }}
      >
        {muted ? "Em breve" : "Continuar →"}
      </button>
    </>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
function EventCard({ event, accent, primary }: { event: EventItem; accent: string; primary: string }) {
  const [hovered, setHovered] = useState(false);
  const month = new Date(event.date + "T12:00:00")
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const day = new Date(event.date + "T12:00:00").getDate();

  return (
    <a
      href={event.ticketUrl}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        boxShadow: hovered ? "0 20px 60px rgba(0,0,0,0.18)" : "0 4px 24px rgba(0,0,0,0.08)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
        <img
          src={event.image}
          alt={event.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: hovered ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.5s ease",
          }}
        />
        {/* Badge gratuito/pago */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "6px 12px",
            background: "rgba(255,255,255,0.95)",
            color: primary,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {event.free ? "GRATUITO" : event.price}
        </div>
        {/* Date badge */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            background: "#fff",
            borderRadius: 12,
            padding: "8px 12px",
            textAlign: "center",
            minWidth: 56,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: primary, lineHeight: 1, fontWeight: 800 }}>
            {day}
          </div>
          <div style={{ fontSize: 10, color: "#666", letterSpacing: 1, marginTop: 2 }}>{month}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, margin: "0 0 12px", color: primary }}>
          {event.title}
        </h3>

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 13, marginBottom: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>
            {event.time} · {formatDate(event.date)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 13, marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{event.location}</span>
        </div>

        <p
          style={{
            color: "#555",
            fontSize: 14,
            lineHeight: 1.5,
            margin: "0 0 16px",
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {event.description}
        </p>

        {/* CTA */}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f0f0f0", color: accent, fontWeight: 600, fontSize: 14 }}>
          {event.free ? "Confirmar Presença →" : "Comprar Ingresso →"}
        </div>
      </div>
    </a>
  );
}

// ── PAYMENTS QUICK ACTIONS (fintech-style) ───────────────────────────────────
type ActionKey = "pix" | "boleto" | "fatura" | "mais";

const QUICK_ACTIONS: { key: ActionKey; label: string; icon: ComponentType<{ className?: string }>; tint: string }[] = [
  { key: "pix",    label: "Pix",          icon: QrCode,         tint: "bg-emerald-100 text-emerald-700" },
  { key: "boleto", label: "Boleto",       icon: Barcode,        tint: "bg-sky-100 text-sky-700" },
  { key: "fatura", label: "Cartão de crédito", icon: CreditCard,     tint: "bg-violet-100 text-violet-700" },
  { key: "mais",   label: "Mais opções",  icon: MoreHorizontal, tint: "bg-amber-100 text-amber-700" },
];

function PaymentsQuickActions({ primary, accent, pixKey }: { primary: string; accent: string; pixKey: string }) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  return (
    <>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" style={{ borderColor: `${primary}1a` }}>
        <div className="grid grid-cols-4 gap-3 sm:gap-6">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setOpen(a.key)}
                className="group flex flex-col items-center gap-2 rounded-xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as string]: accent }}
              >
                <span
                  className={cn(
                    "flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-sm transition-all duration-200",
                    "group-hover:scale-105 group-hover:shadow-md group-active:scale-95 sm:h-24 sm:w-24",
                    a.tint,
                  )}
                >
                  <Icon className="!h-7 !w-7 sm:!h-8 sm:!w-8" />
                </span>
                <span className="text-xs font-medium sm:text-sm" style={{ color: primary }}>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <PixDialog open={open === "pix"} onClose={() => setOpen(null)} pixKey={pixKey} primary={primary} />
      <BoletoDialog open={open === "boleto"} onClose={() => setOpen(null)} primary={primary} />
      <FaturaDialog open={open === "fatura"} onClose={() => setOpen(null)} primary={primary} />
      <MaisDialog open={open === "mais"} onClose={() => setOpen(null)} onPick={(k) => setOpen(k)} />
    </>
  );
}

function PaymentDialogShell({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 backdrop-blur-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function PixDialog({ open, onClose, pixKey, primary }: { open: boolean; onClose: () => void; pixKey: string; primary: string }) {
  const [key, setKey] = useState(pixKey);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success("Chave copiada");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <PaymentDialogShell open={open} onClose={onClose} title="Transferência Pix" description="Envie em segundos para qualquer chave.">
      <div className="space-y-2">
        <Label htmlFor="pix-key">Chave Pix</Label>
        <div className="flex gap-2">
          <Input id="pix-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
          <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copiar chave">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pix-amount">Valor</Label>
        <Input id="pix-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" />
      </div>
      <Button className="w-full text-white" size="lg" style={{ background: primary }} onClick={() => { toast.success("Pagamento iniciado"); onClose(); }}>
        Continuar
      </Button>
    </PaymentDialogShell>
  );
}

function BoletoDialog({ open, onClose, primary }: { open: boolean; onClose: () => void; primary: string }) {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <PaymentDialogShell open={open} onClose={onClose} title="Pagamento de boleto" description="Digite o código ou envie o arquivo.">
      <div className="space-y-2">
        <Label htmlFor="boleto-code">Código de barras</Label>
        <Input id="boleto-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/40 p-4 text-sm transition-colors hover:bg-muted">
        <span className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-muted-foreground">{fileName ?? "Enviar arquivo do boleto (PDF/JPG)"}</span>
        </span>
        <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
      </label>
      <div className="space-y-2">
        <Label htmlFor="boleto-amount">Valor</Label>
        <Input id="boleto-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" />
      </div>
      <Button className="w-full text-white" size="lg" style={{ background: primary }} onClick={() => { toast.success("Boleto enviado para pagamento"); onClose(); }}>
        Pagar
      </Button>
    </PaymentDialogShell>
  );
}

function FaturaDialog({ open, onClose, primary }: { open: boolean; onClose: () => void; primary: string }) {
  const [method, setMethod] = useState<"total" | "minimo" | "outro">("total");
  const [custom, setCustom] = useState("");
  const opts = [
    { id: "total" as const, label: "Pagar valor total", hint: "R$ 1.284,90" },
    { id: "minimo" as const, label: "Pagamento mínimo", hint: "R$ 192,73" },
    { id: "outro" as const, label: "Outro valor", hint: "Você escolhe" },
  ];
  return (
    <PaymentDialogShell open={open} onClose={onClose} title="Fatura do cartão" description="Escolha como deseja pagar.">
      <div className="rounded-xl bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground">Total da fatura</p>
        <p className="text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>R$ 1.284,90</p>
        <p className="mt-1 text-xs text-muted-foreground">Vencimento em 25/05</p>
      </div>
      <div className="grid gap-2">
        {opts.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMethod(opt.id)}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
              method === opt.id ? "bg-primary/5" : "hover:bg-muted/50",
            )}
            style={method === opt.id ? { borderColor: primary } : undefined}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.hint}</span>
          </button>
        ))}
      </div>
      {method === "outro" && (
        <Input inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="R$ 0,00" />
      )}
      <Button className="w-full text-white" size="lg" style={{ background: primary }} onClick={() => { toast.success("Pagamento confirmado"); onClose(); }}>
        Confirmar pagamento
      </Button>
    </PaymentDialogShell>
  );
}

function MaisDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (k: ActionKey) => void }) {
  const items: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }[] = [
    { icon: Smartphone,     label: "Recarga de celular",          onClick: () => toast.info("Em breve") },
    { icon: Receipt,        label: "Contas e impostos",           onClick: () => onPick("boleto") },
    { icon: ArrowLeftRight, label: "Transferência entre contas",  onClick: () => toast.info("Em breve") },
    { icon: PiggyBank,      label: "Investir",                    onClick: () => toast.info("Em breve") },
  ];
  return (
    <PaymentDialogShell open={open} onClose={onClose} title="Mais opções" description="Outras ações disponíveis.">
      <ul className="divide-y rounded-xl border">
        {items.map(({ icon: Icon, label, onClick }) => (
          <li key={label}>
            <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground/80">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </PaymentDialogShell>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
function ChurchPage() {
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const primary = CHURCH.primaryColor;
  const accent = CHURCH.accentColor;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const copyPix = () => {
    navigator.clipboard?.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#fafaf7", color: "#1a1a1a", minHeight: "100vh" }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .fade-up { animation: fadeUp 0.7s ease both; }
        .fade-up-2 { animation: fadeUp 0.7s 0.15s ease both; }
        .fade-up-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .fade-up-4 { animation: fadeUp 0.7s 0.45s ease both; }

        .copy-btn:hover { background: ${primary} !important; color: #fff !important; }
        .donate-link:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${accent}; border-radius: 3px; }
      `}</style>

      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
          transition: "all .3s ease",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: primary,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {initials(CHURCH.name)}
          </div>
          <span style={{ fontWeight: 600, color: scrolled ? "#1a1a1a" : "transparent", transition: "color .3s" }}>
            {CHURCH.name}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="/login"
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                background: scrolled ? primary : "rgba(255,255,255,0.95)",
                color: scrolled ? "#fff" : primary,
                transition: "all .3s ease",
                boxShadow: scrolled ? "none" : "0 2px 12px rgba(0,0,0,0.12)",
              }}
            >
              Entrar
            </a>
            <a
              href="/signup"
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: `1.5px solid ${scrolled ? primary : "rgba(255,255,255,0.7)"}`,
                color: scrolled ? primary : "#fff",
                transition: "all .3s ease",
              }}
            >
              Cadastrar
            </a>
          </div>
        </div>
      </div>

      {/* ── HERO / HEADER ──────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 pt-5 pb-6 text-center sm:px-6 sm:pt-20 sm:pb-24 max-h-[65vh] sm:max-h-none"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`,
          color: "#fff",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-16 -right-16 w-36 h-36 sm:w-80 sm:h-80 sm:-top-30 sm:-right-30 rounded-full"
          style={{ background: `${accent}22` }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-44 h-44 sm:w-96 sm:h-96 sm:-bottom-40 sm:-left-40 rounded-full"
          style={{ background: `${accent}18` }}
        />

        <div className="fade-up relative mx-auto max-w-3xl flex flex-col items-center">
          {/* Logo */}
          <div className="mb-1 sm:mb-6">
            {CHURCH.logo ? (
              <img
                src={CHURCH.logo}
                alt={CHURCH.name}
                className="mx-auto rounded-full object-cover w-11 h-11 sm:w-24 sm:h-24"
                style={{ border: `2px solid ${accent}` }}
              />
            ) : (
              <div
                className="mx-auto grid place-items-center rounded-full w-11 h-11 sm:w-24 sm:h-24 text-sm sm:text-3xl font-extrabold"
                style={{
                  background: "#fff",
                  color: primary,
                  border: `2px solid ${accent}`,
                }}
              >
                {initials(CHURCH.name)}
              </div>
            )}
          </div>

          {/* Church Name */}
          <h1
            className="sm:mb-4 leading-tight"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(1.15rem, 5vw, 3.6rem)",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            {CHURCH.name}
          </h1>
          <p className="font-light" style={{ fontSize: "clamp(0.72rem, 2.2vw, 1.25rem)", opacity: 0.9, margin: "4px 0 0" }}>
            {CHURCH.tagline}
          </p>

          {/* Divider */}
          <div
            className="mt-3 sm:mt-8"
            style={{ width: 40, height: 2, background: accent, borderRadius: 2 }}
          />
        </div>
      </section>

      {/* ── PAYMENTS HUB SECTION (fintech quick actions) ───────────────── */}
      <section className="mx-auto max-w-[1100px] px-6 pt-6 pb-8 sm:py-20">
        <div className="fade-up text-center mb-4 sm:mb-9">
          <span
            className="font-semibold"
            style={{
              fontSize: "clamp(0.6rem, 2vw, 0.75rem)",
              letterSpacing: "0.18em",
              color: accent,
            }}
          >
            ✦ CONTRIBUA COM A OBRA
          </span>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.15rem, 4.5vw, 2.5rem)",
              margin: "4px 0 2px",
              lineHeight: 1.15,
              color: primary,
            }}
          >
            Escolha como deseja contribuir
          </h2>
          <p
            className="mx-auto"
            style={{
              color: "#666",
              fontSize: "clamp(0.78rem, 2.2vw, 1rem)",
              lineHeight: 1.4,
              maxWidth: 620,
              margin: "4px auto 0",
            }}
          >
            Pagamentos rápidos, seguros e sem complicação.
          </p>
        </div>

        <div className="fade-up-2">
          <PaymentsQuickActions primary={primary} accent={accent} pixKey={PIX_KEY} />
        </div>

        <div
          className="fade-up-3 mx-auto mt-4 sm:mt-8 flex items-start gap-3 rounded-xl p-3 sm:p-4 max-w-[720px]"
          style={{ background: `${accent}11` }}
        >
          <span style={{ fontSize: 18 }}>🔒</span>
          <p style={{ margin: 0, fontSize: 12, color: "#555", lineHeight: 1.45 }}>
            Todas as transações são processadas com criptografia e segurança bancária.
            Após sua doação, você receberá uma confirmação no WhatsApp ou SMS cadastrado.
          </p>
        </div>
      </section>

      {/* ── EVENTS SECTION ─────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="fade-up-3" style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Section Header */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 12, letterSpacing: 3, color: accent, fontWeight: 600 }}>✦ AGENDA</span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
                margin: "12px 0 8px",
                color: primary,
              }}
            >
              Próximos Eventos
            </h2>
            <p style={{ color: "#666", margin: 0 }}>
              Clique em qualquer evento para garantir sua participação.
            </p>
          </div>

          {/* Events Grid */}
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {EVENTS.map((event) => (
              <EventCard key={event.id} event={event} accent={accent} primary={primary} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ padding: "48px 24px", textAlign: "center", background: "#fafaf7", borderTop: "1px solid #eee" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            background: primary,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 12px",
            fontWeight: 700,
          }}
        >
          {initials(CHURCH.name)}
        </div>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: primary, margin: "0 0 8px" }}>
          {CHURCH.name}
        </p>
        <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
          Plataforma gerenciada pela{" "}
          <a
            href="https://ankor.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="donate-link"
            style={{ color: accent, fontWeight: 600, textDecoration: "none" }}
          >
            TK2 Prosperidade
          </a>
        </p>
      </footer>
    </div>
  );
}
