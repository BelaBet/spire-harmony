import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Loader2, Lock, Star, X } from "lucide-react";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import { useServerFn } from "@tanstack/react-start";
import { useTenant } from "@/lib/tenant-context";
import { createBoletoPayment } from "@/lib/boleto.functions";

export type ContribMethod = {
  key: "pix" | "boleto" | "fatura" | "mais" | "custom";
  label: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (valor: number) => void;
  method?: ContribMethod;
};

const PRESETS = [10, 25, 50, 100, 200];

const METHOD_COPY: Record<ContribMethod["key"], { title: string; subtitle: string; cta: string }> = {
  pix:    { title: "Contribuir via Pix",          subtitle: "Qual valor você quer contribuir via Pix?",         cta: "Gerar Pix" },
  boleto: { title: "Gerar Boleto",                subtitle: "Qual valor você quer contribuir via Boleto?",      cta: "Gerar Boleto" },
  fatura: { title: "Contribuir com Cartão",       subtitle: "Qual valor você quer contribuir no cartão?",       cta: "Continuar no cartão" },
  mais:   { title: "Escolher forma de pagamento", subtitle: "Qual valor você quer contribuir?",                 cta: "Continuar" },
  custom: { title: "Contribuir",                  subtitle: "Qual valor você quer contribuir?",                 cta: "Continuar" },
};

function generateBoletoCode(valor: number) {
  // mock formatted "linha digitável" 47-digit boleto
  const cents = String(Math.round(valor * 100)).padStart(10, "0");
  const rnd = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  return `${rnd(5)}.${rnd(5)} ${rnd(5)}.${rnd(6)} ${rnd(5)}.${rnd(6)} ${rnd(1)} ${rnd(4)}${cents}`;
}

import Holidays from "date-holidays";

const holidaysCache = new Map<string, Holidays>();
function getHolidays(country: string, state?: string) {
  const key = `${country}:${state ?? ""}`;
  let h = holidaysCache.get(key);
  if (!h) {
    h = state ? new Holidays(country, state) : new Holidays(country);
    holidaysCache.set(key, h);
  }
  return h;
}

function isHoliday(date: Date, country: string, state?: string) {
  const hits = getHolidays(country, state).isHoliday(date);
  if (!hits) return false;
  // Only count public/bank holidays — ignore observance / optional
  const list = Array.isArray(hits) ? hits : [hits];
  return list.some((h) => h.type === "public" || h.type === "bank");
}

function addBusinessDays(date: Date, days: number, country = "BR", state?: string) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    if (isHoliday(d, country, state)) continue;
    added++;
  }
  return d;
}

export function ContribuicaoModal({ isOpen, onClose, onConfirm, method }: Props) {
  const { tenant } = useTenant();
  const createPayment = useServerFn(createBoletoPayment);
  const [selected, setSelected] = useState<number | "custom">(25);
  const [value, setValue] = useState<string>("25");
  const [boleto, setBoleto] = useState<{
    code: string;
    due: Date;
    valor: number;
    paymentId?: string;
    donationId?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = METHOD_COPY[method?.key ?? "custom"];
  const isBoleto = method?.key === "boleto";

  useEffect(() => {
    if (isOpen) {
      setSelected(25);
      setValue("25");
      setBoleto(null);
      setCopied(false);
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pickPreset = (v: number) => {
    setSelected(v);
    setValue(String(v));
  };

  const pickCustom = () => {
    setSelected("custom");
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, "");
    setValue(cleaned);
    const num = Number(cleaned);
    setSelected(PRESETS.includes(num) ? num : "custom");
  };

  const handleConfirm = async () => {
    const num = Number(value);
    if (!num || num <= 0) return;
    if (isBoleto) {
      const code = generateBoletoCode(num);
      const due = addBusinessDays(new Date(), 3);
      if (!tenant?.id) {
        setError("Não foi possível identificar a instituição.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const { paymentId, donationId } = await createPayment({
          data: {
            tenantId: tenant.id,
            amount: num,
            gatewayId: code.replace(/\s|\./g, ""),
          },
        });
        setBoleto({ code, due, valor: num, paymentId, donationId });
        onConfirm?.(num);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao gerar boleto");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    onConfirm?.(num);
    onClose();
  };

  const handleCopy = async () => {
    if (!boleto) return;
    try {
      await navigator.clipboard.writeText(boleto.code.replace(/\s|\./g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const handleDownloadPdf = () => {
    if (!boleto) return;

    const beneficiario = tenant?.name ?? "Beneficiário";
    const valorFmt = `R$ ${boleto.valor.toFixed(2).replace(".", ",")}`;
    const venc = boleto.due.toLocaleDateString("pt-BR");
    const docNum = `${Date.now()}`.slice(-9);
    const nossoNum = `${Date.now()}`.slice(-11);
    const linha = boleto.code;
    // 44-digit barcode (mock derived from linha digitável)
    const barcode = linha.replace(/[^\d]/g, "").slice(0, 44).padEnd(44, "0");

    // Render barcode (Interleaved 2 of 5 — padrão FEBRABAN)
    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, barcode, {
        format: "ITF",
        width: 1.2,
        height: 50,
        displayValue: false,
        margin: 0,
      });
    } catch {
      /* fallback: blank canvas */
    }
    const barcodeDataUrl = canvas.toDataURL("image/png");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    let y = 12;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BOLETO DE CONTRIBUIÇÃO", W / 2, y, { align: "center" });
    y += 4;
    doc.setLineWidth(0.3);
    doc.line(10, y, W - 10, y);
    y += 6;

    // Beneficiário / Cedente
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("BENEFICIÁRIO (CEDENTE)", 12, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(beneficiario, 12, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (tenant?.slug) doc.text(`Identificador: ${tenant.slug}`, 12, y + 10);
    y += 16;

    doc.setDrawColor(180);
    doc.line(10, y, W - 10, y);
    y += 5;

    // Pagador
    doc.setFontSize(8);
    doc.text("PAGADOR", 12, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Contribuinte", 12, y + 5);
    doc.setFont("helvetica", "normal");
    y += 12;

    doc.line(10, y, W - 10, y);
    y += 5;

    // Grid: vencimento / valor / doc / nosso número
    const col = (x: number, label: string, val: string, bold = false) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(label, x, y);
      doc.setFontSize(bold ? 12 : 10);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(val, x, y + 5);
    };
    col(12, "VENCIMENTO", venc, true);
    col(70, "VALOR DO DOCUMENTO", valorFmt, true);
    col(130, "Nº DOCUMENTO", docNum);
    col(170, "NOSSO NÚMERO", nossoNum);
    y += 12;

    doc.setDrawColor(180);
    doc.line(10, y, W - 10, y);
    y += 5;

    // Linha digitável
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("LINHA DIGITÁVEL", 12, y);
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text(linha, W / 2, y + 6, { align: "center" });
    y += 12;

    // Instruções
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("INSTRUÇÕES", 12, y);
    y += 4;
    doc.setFontSize(9);
    const instr = [
      `• Válido por 3 dias úteis. Vencimento em ${venc}.`,
      "• Pagável em qualquer banco, app bancário ou casa lotérica até o vencimento.",
      "• Após o vencimento, o boleto perde a validade — gere um novo na plataforma.",
      "• Em caso de dúvidas, entre em contato com o beneficiário.",
    ];
    instr.forEach((line) => {
      doc.text(line, 12, y);
      y += 5;
    });
    y += 4;

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(10, y, W - 10, y);
    y += 6;

    // Código de barras
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("CÓDIGO DE BARRAS", 12, y);
    y += 2;
    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, "PNG", 12, y, 110, 18);
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(barcode, 12, y + 22);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Documento gerado em ${new Date().toLocaleString("pt-BR")}`,
      W / 2,
      285,
      { align: "center" },
    );

    doc.save(`boleto-${docNum}.pdf`);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="flex items-center justify-center bg-black/60 p-4"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        {boleto ? (
          <>
            <h2 className="mt-1 text-[24px] font-bold leading-tight text-[#111827]">
              Boleto gerado
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Pague no app do seu banco usando o código abaixo.
            </p>

            <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Valor
              </div>
              <div className="mt-0.5 text-2xl font-bold text-[#111827]">
                R$ {boleto.valor.toFixed(2).replace(".", ",")}
              </div>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Vencimento
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[#111827]">
                {boleto.due.toLocaleDateString("pt-BR")} · válido por 3 dias úteis
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">

              <div className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Instituição beneficiária
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[#111827]">
                {tenant?.name ?? "—"}
              </div>
              {tenant?.slug && (
                <div className="text-xs text-[#6B7280]">@{tenant.slug}</div>
              )}
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                <div>
                  <div className="font-medium uppercase tracking-wide text-[#6B7280]">
                    ID do pagamento
                  </div>
                  <div className="break-all font-mono text-[#111827]">
                    {boleto.paymentId ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="font-medium uppercase tracking-wide text-[#6B7280]">
                    ID da doação
                  </div>
                  <div className="break-all font-mono text-[#111827]">
                    {boleto.donationId ?? "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Linha digitável
              </div>
              <div className="mt-1 break-all rounded-xl border border-[#E5E7EB] bg-white p-3 font-mono text-[13px] text-[#111827]">
                {boleto.code}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="mt-3 flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#7C3AED] text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Código copiado" : "Copiar código"}
            </button>

            <button
              onClick={handleDownloadPdf}
              className="mt-2 flex h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white text-sm font-semibold text-[#111827] transition hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Baixar PDF do Boleto
            </button>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
              <Lock className="h-3.5 w-3.5" />
              Pagamento 100% seguro
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE9FE] px-3 py-1 text-xs font-medium text-[#7C3AED]">
              <Star className="h-3.5 w-3.5 fill-[#7C3AED]" />
              Valor mais escolhido
            </div>

            <h2 className="mt-4 text-[28px] font-bold leading-tight text-[#111827]">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">{copy.subtitle}</p>

            <div className="mt-5 flex items-center rounded-xl border-2 border-[#7C3AED] px-4 py-3">
              <span className="text-2xl font-semibold text-[#111827]">R$</span>
              <input
                ref={inputRef}
                inputMode="numeric"
                value={value}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="0"
                className="ml-2 w-full bg-transparent text-3xl font-bold text-[#7C3AED] outline-none placeholder:text-[#7C3AED]/30"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {PRESETS.map((v) => {
                const active = selected === v;
                return (
                  <button
                    key={v}
                    onClick={() => pickPreset(v)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                        : "border-[#E5E7EB] bg-white text-[#111827] hover:border-gray-300"
                    }`}
                  >
                    <span>R${v}</span>
                    {v === 25 && active && (
                      <span className="mt-0.5 text-[10px] font-normal opacity-90">
                        Mais escolhido
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={pickCustom}
                className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                  selected === "custom"
                    ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                    : "border-[#E5E7EB] bg-white text-[#111827] hover:border-gray-300"
                }`}
              >
                Outro valor
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#6B7280]">
              <Lock className="h-3.5 w-3.5" />
              Pagamento 100% seguro
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#7C3AED] text-base font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-50"
              disabled={!Number(value) || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Gerando..." : copy.cta}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ContribuicaoModal;
