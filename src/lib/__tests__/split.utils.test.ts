import { describe, it, expect } from "vitest";
import {
  calculatePixAmounts,
  calculateCardAmounts,
  calculateBoletoAmounts,
} from "../split.utils";
import { FEES } from "../fees.config";

// Helper: garante que todos os campos monetários são inteiros (centavos).
function expectAllIntegers(a: object) {
  for (const [k, v] of Object.entries(a)) {
    expect(Number.isInteger(v), `${k} deve ser inteiro, recebeu ${v}`).toBe(true);
  }
}

describe("calculatePixAmounts", () => {
  it("R$100,00 → fixos absorvidos + 3,5%", () => {
    const a = calculatePixAmounts(10_000);
    expect(a).toEqual({
      donationAmount: 10_000,
      tickettoFee: 350,
      pagarmeFee: 40,
      tk2OpFee: 25,
      transacaoFee: 28,
      splitPlatformAmount: 415, // 350 + 40 + 25
      totalAmount: 10_415,
    });
    expectAllIntegers(a);
  });

  it("R$1,00 — arredondamento de 0,5 centavo", () => {
    // 100 * 0.035 = 3.5 → Math.round → 4
    const a = calculatePixAmounts(100);
    expect(a.tickettoFee).toBe(4);
    expect(a.splitPlatformAmount).toBe(4 + 40 + 25);
    expect(a.totalAmount).toBe(100 + a.splitPlatformAmount);
  });

  it("R$0,33 — arredondamento para baixo", () => {
    // 33 * 0.035 = 1.155 → Math.round → 1
    const a = calculatePixAmounts(33);
    expect(a.tickettoFee).toBe(1);
  });

  it("R$10.000,00 — valor alto sem perda", () => {
    const a = calculatePixAmounts(1_000_000);
    expect(a.tickettoFee).toBe(35_000);
    expect(a.splitPlatformAmount).toBe(35_000 + 40 + 25);
    expect(a.totalAmount).toBe(1_000_000 + a.splitPlatformAmount);
  });

  it("conservação: total = doação + split plataforma", () => {
    for (const v of [50, 199, 1234, 9999, 50_000]) {
      const a = calculatePixAmounts(v);
      expect(a.totalAmount).toBe(a.donationAmount + a.splitPlatformAmount);
    }
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculatePixAmounts(0)).toThrow();
    expect(() => calculatePixAmounts(-100)).toThrow();
    expect(() => calculatePixAmounts(10.5)).toThrow();
  });
});

describe("calculateCardAmounts", () => {
  it("Master/Visa à vista R$100,00", () => {
    const a = calculateCardAmounts(10_000, 1, "master_visa");
    // tk2OpFee = round(10000 * 0.0172 * 0.035) = round(6.02) = 6
    // adquirencia = round(10000 * 0.0207) = 207
    // splitPlatform = 350 + 6 = 356
    // total = 10000 + 356 + 207 = 10563
    expect(a).toEqual({
      donationAmount: 10_000,
      tickettoFee: 350,
      pagarmeFee: 0,
      tk2OpFee: 6,
      transacaoFee: 28,
      splitPlatformAmount: 356,
      totalAmount: 10_563,
    });
    expectAllIntegers(a);
  });

  it("Master/Visa 2x usa adquirencia_2x_percent", () => {
    const a1 = calculateCardAmounts(10_000, 1, "master_visa");
    const a2 = calculateCardAmounts(10_000, 2, "master_visa");
    const f = FEES.cartao_master_visa;
    const adq1 = Math.round(10_000 * f.adquirencia_avista_percent);
    const adq2 = Math.round(10_000 * f.adquirencia_2x_percent);
    expect(a1.totalAmount - a1.splitPlatformAmount - a1.donationAmount).toBe(adq1);
    expect(a2.totalAmount - a2.splitPlatformAmount - a2.donationAmount).toBe(adq2);
  });

  it("Ello/Hiper/Amex à vista R$100,00", () => {
    const a = calculateCardAmounts(10_000, 1, "ello_hiper_amex");
    // adquirencia = round(10000 * 0.0249) = 249
    expect(a).toEqual({
      donationAmount: 10_000,
      tickettoFee: 350,
      pagarmeFee: 0,
      tk2OpFee: 6,
      transacaoFee: 28,
      splitPlatformAmount: 356,
      totalAmount: 10_605,
    });
  });

  it("installments >= 2 sempre usa tabela de parcelado", () => {
    const a3 = calculateCardAmounts(10_000, 3, "master_visa");
    const a12 = calculateCardAmounts(10_000, 12, "master_visa");
    expect(a3.totalAmount).toBe(a12.totalAmount);
  });

  it("R$1,00 — tk2OpFee arredonda para 0", () => {
    // 100 * 0.0172 * 0.035 = 0.0602 → round → 0
    const a = calculateCardAmounts(100, 1, "master_visa");
    expect(a.tk2OpFee).toBe(0);
    expect(a.tickettoFee).toBe(4);
    expectAllIntegers(a);
  });

  it("conservação: total = doação + split plataforma + adquirência", () => {
    for (const v of [200, 1500, 7777, 33_333]) {
      const a = calculateCardAmounts(v, 1, "master_visa");
      const adq = a.totalAmount - a.donationAmount - a.splitPlatformAmount;
      expect(adq).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(adq)).toBe(true);
    }
  });
});

describe("calculateBoletoAmounts", () => {
  it("R$100,00", () => {
    const a = calculateBoletoAmounts(10_000);
    // splitPlatform = ticketto + tk2OpFixo = 350 + 250 = 600
    // total = 10000 + 600 + pagarmeFee(100) = 10700
    expect(a).toEqual({
      donationAmount: 10_000,
      tickettoFee: 350,
      pagarmeFee: 100,
      tk2OpFee: 250,
      transacaoFee: 28,
      splitPlatformAmount: 600,
      totalAmount: 10_700,
    });
    expectAllIntegers(a);
  });

  it("conservação: total = doação + split plataforma + adquirência fixa", () => {
    for (const v of [500, 1234, 50_000, 250_000]) {
      const a = calculateBoletoAmounts(v);
      expect(a.totalAmount).toBe(a.donationAmount + a.splitPlatformAmount + a.pagarmeFee);
    }
  });

  it("R$0,50 — arredondamento de 1,75 centavo", () => {
    // 50 * 0.035 = 1.75 → round → 2
    const a = calculateBoletoAmounts(50);
    expect(a.tickettoFee).toBe(2);
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculateBoletoAmounts(0)).toThrow();
    expect(() => calculateBoletoAmounts(-1)).toThrow();
  });
});
