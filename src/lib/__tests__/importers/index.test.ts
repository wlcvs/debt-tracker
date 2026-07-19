import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExtractTextPages = vi.hoisted(() => vi.fn());
const mockNubankParse = vi.hoisted(() => vi.fn());
const mockItauParse = vi.hoisted(() => vi.fn());
const mockMercadoPagoParse = vi.hoisted(() => vi.fn());
const mockBradescoParse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/importers/base", () => ({ extractTextPages: mockExtractTextPages }));
vi.mock("@/lib/importers/nubank", () => ({ parse: mockNubankParse }));
vi.mock("@/lib/importers/itau", () => ({ parse: mockItauParse }));
vi.mock("@/lib/importers/mercadopago", () => ({ parse: mockMercadoPagoParse }));
vi.mock("@/lib/importers/bradesco", () => ({ parse: mockBradescoParse }));

import { detectAndParse } from "@/lib/importers";

function setPages(...lines: string[]): void {
  mockExtractTextPages.mockResolvedValue(lines);
}

function txns(n: number) {
  return Array.from({ length: n }, (_, i) => ({ date: "2026-01-01", description: `t${i}`, amount: 1 }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectAndParse", () => {
  // ── keyword precedence ──────────────────────────────────────────────────

  describe("keyword precedence", () => {
    it("Nubank keyword wins over Bradesco even when 'bradesco' also appears", async () => {
      setPages("Nubank fatura", "Pagamento via TED BCO BRADESCO S.A.");
      mockNubankParse.mockResolvedValue(txns(1));
      const result = await detectAndParse(Buffer.from(""));
      expect(result.bank).toBe("Nubank");
      expect(mockNubankParse).toHaveBeenCalled();
      expect(mockBradescoParse).not.toHaveBeenCalled();
    });

    it("'banco bradesco' wins over Itaú", async () => {
      setPages("Extrato Banco Bradesco", "menciona itau em algum lugar");
      mockBradescoParse.mockResolvedValue(txns(1));
      const result = await detectAndParse(Buffer.from(""));
      expect(result.bank).toBe("Bradesco");
      expect(mockBradescoParse).toHaveBeenCalled();
      expect(mockItauParse).not.toHaveBeenCalled();
    });

    it("Itaú wins over Mercado Pago", async () => {
      setPages("Fatura Itaú", "referência a mercado pago");
      mockItauParse.mockResolvedValue(txns(1));
      const result = await detectAndParse(Buffer.from(""));
      expect(result.bank).toBe("Itaú");
      expect(mockItauParse).toHaveBeenCalled();
      expect(mockMercadoPagoParse).not.toHaveBeenCalled();
    });

    it("Mercado Pago wins over bare 'bradesco' (last-resort keyword)", async () => {
      setPages("Fatura Mercado Pago", "pagamento para bradesco");
      mockMercadoPagoParse.mockResolvedValue(txns(1));
      const result = await detectAndParse(Buffer.from(""));
      expect(result.bank).toBe("Mercado Pago");
      expect(mockMercadoPagoParse).toHaveBeenCalled();
      expect(mockBradescoParse).not.toHaveBeenCalled();
    });

    it("bare 'bradesco' (last resort, no 'celular'/'banco' prefix) still resolves to Bradesco", async () => {
      setPages("Extrato bradesco sem cabeçalho celular");
      mockBradescoParse.mockResolvedValue(txns(1));
      const result = await detectAndParse(Buffer.from(""));
      expect(result.bank).toBe("Bradesco");
    });
  });

  // ── case-insensitivity ───────────────────────────────────────────────────

  it("detects Nubank case-insensitively (uppercase)", async () => {
    setPages("NUBANK STATEMENT");
    mockNubankParse.mockResolvedValue(txns(1));
    const result = await detectAndParse(Buffer.from(""));
    expect(result.bank).toBe("Nubank");
  });

  // ── accented / unaccented Itaú ───────────────────────────────────────────

  it("detects accented 'Itaú'", async () => {
    setPages("Fatura Itaú");
    mockItauParse.mockResolvedValue(txns(1));
    const result = await detectAndParse(Buffer.from(""));
    expect(result.bank).toBe("Itaú");
  });

  it("detects unaccented 'Itau'", async () => {
    setPages("Fatura Itau");
    mockItauParse.mockResolvedValue(txns(1));
    const result = await detectAndParse(Buffer.from(""));
    expect(result.bank).toBe("Itaú");
  });

  // ── fallback race (no keyword matched) ──────────────────────────────────

  describe("fallback race when no keyword matches", () => {
    it("calls all 4 parsers, catches throwers, and picks the one with the most transactions", async () => {
      setPages("statement with no recognizable bank keyword");
      mockNubankParse.mockResolvedValue(txns(2));
      mockItauParse.mockResolvedValue(txns(5));
      mockMercadoPagoParse.mockResolvedValue(txns(0));
      mockBradescoParse.mockRejectedValue(new Error("boom"));

      const result = await detectAndParse(Buffer.from(""));

      expect(mockNubankParse).toHaveBeenCalled();
      expect(mockItauParse).toHaveBeenCalled();
      expect(mockMercadoPagoParse).toHaveBeenCalled();
      expect(mockBradescoParse).toHaveBeenCalled();
      expect(result.bank).toBe("Itaú (detectado)");
      expect(result.transactions).toHaveLength(5);
    });

    it("tie-break: equal non-zero counts favor the first parser in iteration order (Nubank, Itaú, Mercado Pago, Bradesco)", async () => {
      setPages("statement with no recognizable bank keyword");
      mockNubankParse.mockResolvedValue(txns(3));
      mockItauParse.mockResolvedValue(txns(3));
      mockMercadoPagoParse.mockResolvedValue(txns(0));
      mockBradescoParse.mockResolvedValue(txns(0));

      const result = await detectAndParse(Buffer.from(""));

      expect(result.bank).toBe("Nubank (detectado)");
      expect(result.transactions).toHaveLength(3);
    });

    it("returns Desconhecido when all 4 parsers throw", async () => {
      setPages("statement with no recognizable bank keyword");
      mockNubankParse.mockRejectedValue(new Error("a"));
      mockItauParse.mockRejectedValue(new Error("b"));
      mockMercadoPagoParse.mockRejectedValue(new Error("c"));
      mockBradescoParse.mockRejectedValue(new Error("d"));

      const result = await detectAndParse(Buffer.from(""));

      expect(result).toEqual({ bank: "Desconhecido", transactions: [] });
    });

    it("returns Desconhecido when all 4 parsers resolve with empty transaction arrays", async () => {
      setPages("statement with no recognizable bank keyword");
      mockNubankParse.mockResolvedValue([]);
      mockItauParse.mockResolvedValue([]);
      mockMercadoPagoParse.mockResolvedValue([]);
      mockBradescoParse.mockResolvedValue([]);

      const result = await detectAndParse(Buffer.from(""));

      expect(result).toEqual({ bank: "Desconhecido", transactions: [] });
    });
  });
});
