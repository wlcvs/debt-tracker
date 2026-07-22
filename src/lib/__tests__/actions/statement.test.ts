import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/importers", () => ({ detectAndParse: vi.fn() }));
vi.mock("@/lib/importers/base", () => ({ extractTextPages: vi.fn().mockResolvedValue(["extracted text"]) }));
vi.mock("@/lib/LLM-extract", () => ({ healthCheck: vi.fn(), extract: vi.fn() }));

import { auth } from "@/auth";
import { detectAndParse } from "@/lib/importers";
import { healthCheck, extract } from "@/lib/LLM-extract";
import {
  getStatements,
  importStatement,
  reopenStatement,
  saveImportedTransactions,
  saveLLMFeedback,
  deleteStatement,
  renameStatement,
} from "@/lib/actions/statement";

const mockAuth = vi.mocked(auth);
const mockDetectAndParse = vi.mocked(detectAndParse);
const mockHealthCheck = vi.mocked(healthCheck);
const mockExtract = vi.mocked(extract);

type ExtendedStatement = typeof prismaMock.statement & {
  updateMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
  (prismaMock.statement as ExtendedStatement).updateMany = vi.fn().mockResolvedValue({});
});

// ── getStatements ─────────────────────────────────────────────────────────────

describe("getStatements", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(getStatements()).rejects.toThrow("Not authenticated");
  });

  it("returns statements scoped to the user, newest first", async () => {
    prismaMock.statement.findMany.mockResolvedValue([{ id: "s1" }]);
    const result = await getStatements();
    expect(result).toEqual([{ id: "s1" }]);
    expect(prismaMock.statement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, orderBy: { uploadedAt: "desc" } })
    );
  });

  it("returns an empty list when the user has no statements", async () => {
    prismaMock.statement.findMany.mockResolvedValue([]);
    expect(await getStatements()).toEqual([]);
  });
});

// ── importStatement ───────────────────────────────────────────────────────────

describe("importStatement", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(importStatement(new FormData())).rejects.toThrow("Not authenticated");
  });

  it("throws when no file is provided", async () => {
    await expect(importStatement(new FormData())).rejects.toThrow("Nenhum arquivo enviado.");
  });

  it("throws when the file is not a PDF", async () => {
    const fd = new FormData();
    fd.set("pdf", new File(["x"], "statement.txt"));
    await expect(importStatement(fd)).rejects.toThrow("O arquivo deve ser um PDF.");
  });

  it("saves algorithmic results and falls back to algo text when LLM is offline", async () => {
    mockDetectAndParse.mockResolvedValue({
      bank: "Nubank",
      transactions: [{ date: "2026-01-01", description: "X", amount: 10 }],
    });
    mockHealthCheck.mockResolvedValue(false);
    prismaMock.statement.create.mockResolvedValue({ id: "stmt-1" });

    const fd = new FormData();
    fd.set("pdf", new File(["%PDF-1.4"], "statement.pdf"));

    const result = await importStatement(fd);

    expect(mockExtract).not.toHaveBeenCalled();
    expect(result.LLMAvailable).toBe(false);
    expect(result.algorithm).toEqual([{ index: 0, date: "2026-01-01", description: "X", amount: 10 }]);
    expect(result.extractedText).toBe("extracted text");
    expect(prismaMock.statement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", bank: "Nubank", transactionCount: 1 }),
      })
    );
  });

  it("merges in LLM results and uses the LLM's extracted text when online", async () => {
    mockDetectAndParse.mockResolvedValue({ bank: "Itaú", transactions: [] });
    mockHealthCheck.mockResolvedValue(true);
    prismaMock.lLMFeedback.findMany.mockResolvedValue([]);
    mockExtract.mockResolvedValue({
      transactions: [{ index: 0, date: "2026-01-01", description: "Y", amount: 5 }],
      extractedText: "LLM text",
    });
    prismaMock.statement.create.mockResolvedValue({ id: "stmt-2" });

    const fd = new FormData();
    fd.set("pdf", new File(["%PDF-1.4"], "statement.pdf"));

    const result = await importStatement(fd);

    expect(result.LLMAvailable).toBe(true);
    expect(result.LLM).toEqual([{ index: 0, date: "2026-01-01", description: "Y", amount: 5 }]);
    expect(result.extractedText).toBe("LLM text");
  });

  it("falls back to algo-derived extracted text when the LLM is online but returns nothing useful", async () => {
    mockDetectAndParse.mockResolvedValue({ bank: "Bradesco", transactions: [] });
    mockHealthCheck.mockResolvedValue(true);
    prismaMock.lLMFeedback.findMany.mockResolvedValue([]);
    mockExtract.mockResolvedValue({});
    prismaMock.statement.create.mockResolvedValue({ id: "stmt-3" });

    const fd = new FormData();
    fd.set("pdf", new File(["%PDF-1.4"], "statement.pdf"));

    const result = await importStatement(fd);

    expect(result.LLMAvailable).toBe(true);
    expect(result.LLM).toEqual([]);
    expect(result.extractedText).toBe("extracted text");
  });
});

// ── reopenStatement ───────────────────────────────────────────────────────────

describe("reopenStatement", () => {
  it("throws when the statement doesn't belong to the user", async () => {
    prismaMock.statement.findFirst.mockResolvedValue(null);
    await expect(reopenStatement("stmt-1")).rejects.toThrow("Extrato não encontrado.");
  });

  it("uses cached LLM results without re-hitting the LLM server", async () => {
    prismaMock.statement.findFirst.mockResolvedValue({
      id: "stmt-1",
      bank: "Nubank",
      pdfData: Buffer.from("pdf"),
      algoResults: [{ index: 0, date: "2026-01-01", description: "X", amount: 10 }],
      LLMResults: [{ index: 0, date: "2026-01-01", description: "X", amount: 10 }],
      extractedText: "cached text",
    });

    const result = await reopenStatement("stmt-1");

    expect(mockHealthCheck).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.extractedText).toBe("cached text");
  });

  it("re-runs the LLM when fresh is requested", async () => {
    prismaMock.statement.findFirst.mockResolvedValue({
      id: "stmt-1",
      bank: "Nubank",
      pdfData: Buffer.from("pdf"),
      algoResults: [],
      LLMResults: [{ index: 0, date: "2026-01-01", description: "old", amount: 1 }],
      extractedText: "old text",
    });
    mockHealthCheck.mockResolvedValue(true);
    prismaMock.lLMFeedback.findMany.mockResolvedValue([]);
    mockExtract.mockResolvedValue({
      transactions: [{ index: 0, date: "2026-01-02", description: "new", amount: 2 }],
      extractedText: "new text",
    });

    const result = await reopenStatement("stmt-1", { fresh: true });

    expect(mockExtract).toHaveBeenCalled();
    expect(result.cached).toBe(false);
    expect(result.LLM).toEqual([{ index: 0, date: "2026-01-02", description: "new", amount: 2 }]);
    expect(prismaMock.statement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "stmt-1" } })
    );
  });

  it("re-runs the LLM automatically when there's no cache yet", async () => {
    prismaMock.statement.findFirst.mockResolvedValue({
      id: "stmt-1",
      bank: "Nubank",
      pdfData: Buffer.from("pdf"),
      algoResults: [],
      LLMResults: [],
      extractedText: "",
    });
    mockHealthCheck.mockResolvedValue(false);

    const result = await reopenStatement("stmt-1");

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(result.LLMAvailable).toBe(false);
    expect(result.extractedText).toBe("extracted text");
  });

  it("does not persist a cache update when a fresh re-run yields no results and no text", async () => {
    prismaMock.statement.findFirst.mockResolvedValue({
      id: "stmt-1",
      bank: "Nubank",
      pdfData: Buffer.from("pdf"),
      algoResults: [],
      LLMResults: [{ index: 0, date: "2026-01-01", description: "old", amount: 1 }],
      extractedText: "old text",
    });
    mockHealthCheck.mockResolvedValue(true);
    prismaMock.lLMFeedback.findMany.mockResolvedValue([]);
    mockExtract.mockResolvedValue({});

    await reopenStatement("stmt-1", { fresh: true });

    expect(prismaMock.statement.update).not.toHaveBeenCalled();
  });
});

// ── saveImportedTransactions ──────────────────────────────────────────────────

describe("saveImportedTransactions", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(saveImportedTransactions([])).rejects.toThrow("Not authenticated");
  });

  it("creates a debt and a payment, skipping foreign and invalid items", async () => {
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1" }]);

    const result = await saveImportedTransactions([
      { type: "debt", personId: "p1", amount: "10.00", date: "2026-01-01", title: "T", notes: "N" },
      { type: "payment", personId: "p1", amount: "5.00", date: "2026-01-02", notes: "P" },
      { type: "debt", personId: "not-owned", amount: "1", date: "2026-01-01" },
      { type: "debt", personId: "p1", amount: "garbage", date: "2026-01-01" },
    ]);

    expect(result.created).toBe(2);
    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: "p1", title: "T", description: "N" }) })
    );
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: "p1", description: "P", method: "PIX" }) })
    );
  });

  it("returns created: 0 when every item is invalid", async () => {
    const result = await saveImportedTransactions([{ type: "bogus" }]);
    expect(result).toEqual({ created: 0 });
  });

  it("truncates an overly long description/notes to the schema's max length", async () => {
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1" }]);

    const longNotes = "n".repeat(600);
    await saveImportedTransactions([
      { type: "debt", personId: "p1", amount: "10.00", date: "2026-01-01", title: "T", notes: longNotes },
    ]);

    expect(prismaMock.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: "n".repeat(500) }) })
    );
  });

  it("falls back the debt title to the description, then to 'Importado' when both are absent", async () => {
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1" }]);

    await saveImportedTransactions([
      { type: "debt", personId: "p1", amount: "10.00", date: "2026-01-01", description: "Compra" },
      { type: "debt", personId: "p1", amount: "20.00", date: "2026-01-02" },
    ]);

    expect(prismaMock.debt.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ title: "Compra" }) })
    );
    expect(prismaMock.debt.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ title: "Importado" }) })
    );
  });

  it("skips items with an unparseable date", async () => {
    prismaMock.person.findMany.mockResolvedValue([{ id: "p1" }]);

    const result = await saveImportedTransactions([
      { type: "debt", personId: "p1", amount: "10.00", date: "not-a-date" },
    ]);

    expect(result.created).toBe(0);
    expect(prismaMock.debt.create).not.toHaveBeenCalled();
  });
});

// ── saveLLMFeedback ───────────────────────────────────────────────────────────

describe("saveLLMFeedback", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(saveLLMFeedback("Nubank", [])).rejects.toThrow("Not authenticated");
  });

  it("saves valid corrections and skips invalid ones", async () => {
    const result = await saveLLMFeedback("Nubank", [
      { date: "2026-01-01", description: "x".repeat(300), amount: "9.99", context: "ctx" },
      { description: "missing date and amount" },
    ]);

    expect(result.saved).toBe(1);
    expect(prismaMock.lLMFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", bank: "Nubank", description: "x".repeat(255) }),
      })
    );
  });

  it("defaults context to an empty string when omitted", async () => {
    await saveLLMFeedback("Itaú", [{ date: "2026-01-01", description: "x", amount: "1.00" }]);

    expect(prismaMock.lLMFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ context: "" }) })
    );
  });

  it("truncates an overly long context to 2000 characters", async () => {
    const longContext = "c".repeat(2500);
    await saveLLMFeedback("Itaú", [
      { date: "2026-01-01", description: "x", amount: "1.00", context: longContext },
    ]);

    expect(prismaMock.lLMFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ context: "c".repeat(2000) }) })
    );
  });

  it("saves multiple valid corrections and reports the correct count when some are invalid", async () => {
    const result = await saveLLMFeedback("Itaú", [
      { date: "2026-01-01", description: "a", amount: "1.00" },
      { description: "invalid, missing date/amount" },
      { date: "2026-01-02", description: "b", amount: "2.00" },
    ]);

    expect(result.saved).toBe(2);
    expect(prismaMock.lLMFeedback.create).toHaveBeenCalledTimes(2);
  });
});

// ── deleteStatement ───────────────────────────────────────────────────────────

describe("deleteStatement", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(deleteStatement("stmt-1")).rejects.toThrow("Not authenticated");
  });

  it("deletes scoped to the user", async () => {
    await deleteStatement("stmt-1");
    expect(prismaMock.statement.deleteMany).toHaveBeenCalledWith({ where: { id: "stmt-1", userId: "user-1" } });
  });

  it("scopes the delete to a different authenticated user's ownership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-2" } } as never);
    await deleteStatement("stmt-9");
    expect(prismaMock.statement.deleteMany).toHaveBeenCalledWith({ where: { id: "stmt-9", userId: "user-2" } });
  });
});

// ── renameStatement ───────────────────────────────────────────────────────────

describe("renameStatement", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(renameStatement("stmt-1", "novo-nome.pdf")).rejects.toThrow("Not authenticated");
  });

  it("throws on an empty filename", async () => {
    await expect(renameStatement("stmt-1", "  ")).rejects.toThrow();
  });

  it("updates the filename scoped to the user", async () => {
    await renameStatement("stmt-1", "extrato-julho.pdf");
    expect((prismaMock.statement as ExtendedStatement).updateMany).toHaveBeenCalledWith({
      where: { id: "stmt-1", userId: "user-1" },
      data: { filename: "extrato-julho.pdf" },
    });
  });

  it("throws when the filename exceeds 255 characters", async () => {
    await expect(renameStatement("stmt-1", "a".repeat(256))).rejects.toThrow();
  });
});
