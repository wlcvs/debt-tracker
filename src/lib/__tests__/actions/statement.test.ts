import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/importers", () => ({ detectAndParse: vi.fn() }));
vi.mock("@/lib/importers/base", () => ({ extractTextPages: vi.fn().mockResolvedValue(["extracted text"]) }));
vi.mock("@/lib/llm-extract", () => ({ healthCheck: vi.fn(), extract: vi.fn() }));

import { auth } from "@/auth";
import { detectAndParse } from "@/lib/importers";
import { healthCheck, extract } from "@/lib/llm-extract";
import {
  getStatements,
  importStatement,
  reopenStatement,
  saveImportedTransactions,
  saveLlmFeedback,
  deleteStatement,
} from "@/lib/actions/statement";

const mockAuth = vi.mocked(auth);
const mockDetectAndParse = vi.mocked(detectAndParse);
const mockHealthCheck = vi.mocked(healthCheck);
const mockExtract = vi.mocked(extract);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
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
    expect(result.llmAvailable).toBe(false);
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
      extractedText: "llm text",
    });
    prismaMock.statement.create.mockResolvedValue({ id: "stmt-2" });

    const fd = new FormData();
    fd.set("pdf", new File(["%PDF-1.4"], "statement.pdf"));

    const result = await importStatement(fd);

    expect(result.llmAvailable).toBe(true);
    expect(result.llm).toEqual([{ index: 0, date: "2026-01-01", description: "Y", amount: 5 }]);
    expect(result.extractedText).toBe("llm text");
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
      llmResults: [{ index: 0, date: "2026-01-01", description: "X", amount: 10 }],
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
      llmResults: [{ index: 0, date: "2026-01-01", description: "old", amount: 1 }],
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
    expect(result.llm).toEqual([{ index: 0, date: "2026-01-02", description: "new", amount: 2 }]);
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
      llmResults: [],
      extractedText: "",
    });
    mockHealthCheck.mockResolvedValue(false);

    const result = await reopenStatement("stmt-1");

    expect(mockHealthCheck).toHaveBeenCalled();
    expect(result.llmAvailable).toBe(false);
    expect(result.extractedText).toBe("extracted text");
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
});

// ── saveLlmFeedback ───────────────────────────────────────────────────────────

describe("saveLlmFeedback", () => {
  it("throws when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    await expect(saveLlmFeedback("Nubank", [])).rejects.toThrow("Not authenticated");
  });

  it("saves valid corrections and skips invalid ones", async () => {
    const result = await saveLlmFeedback("Nubank", [
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
});
