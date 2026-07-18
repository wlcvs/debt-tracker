import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanLines, extract } from "@/lib/llm-extract/bradesco";
import * as ollamaClient from "@/lib/llm-extract/ollama-client";
import * as importersBase from "@/lib/importers/base";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

function fixture(name: string): Buffer | null {
  const p = path.join(FIXTURES_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cleanLines", () => {
  function mockPage(lines: string[]) {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([lines.join("\n")]);
  }

  it("buffers a type label, amounts line, and DES: recipient line into one clean row", async () => {
    mockPage([
      "Histórico Débito",
      "01/06/2026 PIX ENVIADO",
      "01/06/2026 000123 186,69 1.500,00",
      "DES: FULANO DE TAL 01/06",
      "Saldo Final",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-06-01 FULANO DE TAL 186.69");
  });

  it("falls back to the type label when no DES:/REMET. line follows", async () => {
    mockPage([
      "Histórico Débito",
      "01/06/2026 TARIFA MANUTENCAO",
      "01/06/2026 000456 1,50 999,00",
      "Saldo Final",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-06-01 TARIFA MANUTENCAO 1.50");
  });

  it("skips entries matching the skip regex (e.g. PIX RECEBIDO)", async () => {
    mockPage(["Histórico Débito", "01/06/2026 PIX RECEBIDO 200,00 999,00", "Saldo Final"]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("");
  });

  it("only considers lines within the Histórico Débito .. Saldo Final section", async () => {
    mockPage([
      "some preamble",
      "Histórico Débito",
      "01/06/2026 PIX ENVIADO",
      "01/06/2026 000001 10,00 100,00",
      "Saldo Final",
      "01/06/2026 PIX ENVIADO",
      "01/06/2026 000002 999,00 999,00",
    ]);

    const text = await cleanLines(Buffer.from("irrelevant"));
    expect(text).toBe("2026-06-01 PIX ENVIADO 10.00");
  });
});

describe("extract", () => {
  it("returns no transactions when there are no clean lines", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue([""]);
    vi.spyOn(ollamaClient, "chatComplete");
    const [txns, text] = await extract(Buffer.from("irrelevant"), []);
    expect(txns).toEqual([]);
    expect(text).toBe("");
    expect(ollamaClient.chatComplete).not.toHaveBeenCalled();
  });

  it("calls the LLM with the pass-through system prompt override on real PDF", async () => {
    const data = fixture("8b5e4279-81c5-4df5-a4a9-1f403bdf7155.pdf");
    if (!data) return;

    vi.spyOn(ollamaClient, "chatComplete").mockResolvedValue("[]");
    await extract(data, []);
    const [systemArg] = vi.mocked(ollamaClient.chatComplete).mock.calls[0];
    expect(systemArg).toContain("do NOT skip, filter, or deduplicate");
  });
});
