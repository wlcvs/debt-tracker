import { describe, it, expect, vi, afterEach } from "vitest";
import { extract } from "@/lib/LLM-extract/dispatch";
import * as itau from "@/lib/LLM-extract/itau";
import * as nubank from "@/lib/LLM-extract/nubank";
import * as bradesco from "@/lib/LLM-extract/bradesco";
import * as mercadopago from "@/lib/LLM-extract/mercadopago";
import * as base from "@/lib/LLM-extract/base";
import * as importersBase from "@/lib/importers/base";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extract dispatch", () => {
  it("routes to the Itaú extractor", async () => {
    vi.spyOn(itau, "extract").mockResolvedValue([[], "itau text"]);
    const [, text] = await extract(Buffer.from("x"), "Itaú", []);
    expect(text).toBe("itau text");
    expect(itau.extract).toHaveBeenCalled();
  });

  it("routes to the Nubank extractor", async () => {
    vi.spyOn(nubank, "extract").mockResolvedValue([[], "nubank text"]);
    const [, text] = await extract(Buffer.from("x"), "Nubank", []);
    expect(text).toBe("nubank text");
  });

  it("routes to the Bradesco extractor", async () => {
    vi.spyOn(bradesco, "extract").mockResolvedValue([[], "bradesco text"]);
    const [, text] = await extract(Buffer.from("x"), "Bradesco", []);
    expect(text).toBe("bradesco text");
  });

  it("routes to the Mercado Pago extractor", async () => {
    vi.spyOn(mercadopago, "extract").mockResolvedValue([[], "mp text"]);
    const [, text] = await extract(Buffer.from("x"), "Mercado Pago", []);
    expect(text).toBe("mp text");
  });

  it("falls back to extractGeneric for an unrecognized bank", async () => {
    vi.spyOn(importersBase, "extractTextPages").mockResolvedValue(["full text"]);
    vi.spyOn(base, "extractGeneric").mockResolvedValue([[], "generic text"]);
    const [, text] = await extract(Buffer.from("x"), "Desconhecido", []);
    expect(text).toBe("generic text");
    expect(base.extractGeneric).toHaveBeenCalled();
  });

  it("routes the 'Bradesco (detectado)' fallback-detected name to the Bradesco extractor", async () => {
    vi.spyOn(bradesco, "extract").mockResolvedValue([[], "bradesco text"]);
    const [, text] = await extract(Buffer.from("x"), "Bradesco (detectado)", []);
    expect(text).toBe("bradesco text");
  });
});
