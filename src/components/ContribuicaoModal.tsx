import { useEffect, useRef, useState } from "react";
import { Lock, Star, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (valor: number) => void;
};

const PRESETS = [10, 25, 50, 100, 200];

export function ContribuicaoModal({ isOpen, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<number | "custom">(25);
  const [value, setValue] = useState<string>("25");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelected(25);
      setValue("25");
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

  const handleConfirm = () => {
    const num = Number(value);
    if (!num || num <= 0) return;
    onConfirm?.(num);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE9FE] px-3 py-1 text-xs font-medium text-[#7C3AED]">
          <Star className="h-3.5 w-3.5 fill-[#7C3AED]" />
          Valor mais escolhido
        </div>

        <h2 className="mt-4 text-[28px] font-bold leading-tight text-[#111827]">
          Contribuir
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Qual valor você quer contribuir?
        </p>

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

        <button
          onClick={handleConfirm}
          className="mt-4 h-[52px] w-full rounded-full bg-[#7C3AED] text-base font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-50"
          disabled={!Number(value)}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

export default ContribuicaoModal;
