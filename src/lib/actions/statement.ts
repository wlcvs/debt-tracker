"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { detectAndParse } from "@/lib/importers";
import { extractTextPages } from "@/lib/importers/base";
import { healthCheck, extract, type LlmCorrection } from "@/lib/llm-client";

// Note: `maxDuration` cannot be exported from this file — Next.js requires
// every export of a "use server" module to be an async function, and a
// non-function export here breaks the module's client bundle entirely (see
// the (dashboard)/page.tsx route segment, which sets it instead). The LLM
// client's own timeout (see src/lib/llm-client.ts) is set a couple seconds
// under that ceiling, so a slow LLM server always resolves to the
// graceful-degradation path before the platform kills the whole function.

function toJson(value: unknown): object {
  return JSON.parse(JSON.stringify(value));
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function getCorrections(userId: string, bank: string): Promise<LlmCorrection[]> {
  const feedback = await prisma.lLMFeedback.findMany({
    where: { userId, bank },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { date: true, description: true, amount: true },
  });

  return feedback.map((f) => ({
    date: f.date.toISOString().slice(0, 10),
    description: f.description,
    amount: Number(f.amount).toFixed(2),
  }));
}

// ── getStatements ────────────────────────────────────────────────────────────

export interface StatementSummary {
  id: string;
  bank: string;
  filename: string;
  transactionCount: number;
  uploadedAt: Date;
}

export async function getStatements(): Promise<StatementSummary[]> {
  const userId = await requireUserId();

  return prisma.statement.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, bank: true, filename: true, transactionCount: true, uploadedAt: true },
  });
}

// ── importStatement ──────────────────────────────────────────────────────────

export interface ImportResult {
  statementId: string;
  bank: string;
  algorithm: Record<string, unknown>[];
  llm: Record<string, unknown>[];
  extractedText: string;
  llmAvailable: boolean;
}

export async function importStatement(formData: FormData): Promise<ImportResult> {
  const userId = await requireUserId();

  const file = formData.get("pdf");
  if (!(file instanceof File)) throw new Error("Nenhum arquivo enviado.");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("O arquivo deve ser um PDF.");

  const buffer = Buffer.from(await file.arrayBuffer());

  const { bank, transactions } = await detectAndParse(buffer);
  const algoResults = transactions.map((t, i) => ({ index: i, ...t }));

  const llmOnline = await healthCheck();
  const corrections = llmOnline ? await getCorrections(userId, bank) : [];
  const llmData = llmOnline ? await extract(buffer, bank, corrections) : {};
  const llmResults = "transactions" in llmData ? llmData.transactions : [];
  let extractedText = "extractedText" in llmData ? llmData.extractedText : "";

  if (!extractedText) {
    const pages = await extractTextPages(buffer);
    extractedText = pages.join("\n\n").trim();
  }

  const statement = await prisma.statement.create({
    data: {
      userId,
      bank,
      filename: file.name,
      pdfData: buffer,
      transactionCount: Math.max(algoResults.length, llmResults.length),
      algoResults: toJson(algoResults),
      llmResults: toJson(llmResults),
      extractedText,
    },
  });

  revalidatePath("/");

  return {
    statementId: statement.id,
    bank,
    algorithm: algoResults,
    llm: llmResults,
    extractedText,
    llmAvailable: llmOnline,
  };
}

// ── reopenStatement ──────────────────────────────────────────────────────────

export interface ReopenResult extends ImportResult {
  cached: boolean;
}

export async function reopenStatement(id: string, opts: { fresh?: boolean } = {}): Promise<ReopenResult> {
  const userId = await requireUserId();

  const stmt = await prisma.statement.findFirst({ where: { id, userId } });
  if (!stmt) throw new Error("Extrato não encontrado.");

  const bank = stmt.bank;
  const buffer = Buffer.from(stmt.pdfData);
  const algoResults = (stmt.algoResults as Record<string, unknown>[]) ?? [];
  const cachedLlmResults = (stmt.llmResults as Record<string, unknown>[]) ?? [];

  let llmResults: Record<string, unknown>[];
  let extractedText: string;
  let llmOnline: boolean;

  if (opts.fresh || cachedLlmResults.length === 0) {
    llmOnline = await healthCheck();
    const corrections = llmOnline ? await getCorrections(userId, bank) : [];
    const llmData = llmOnline ? await extract(buffer, bank, corrections) : {};
    llmResults = "transactions" in llmData ? llmData.transactions : [];
    extractedText = "extractedText" in llmData ? llmData.extractedText : "";

    if (llmResults.length > 0 || extractedText) {
      await prisma.statement.update({
        where: { id },
        data: { llmResults: toJson(llmResults), extractedText },
      });
    }
  } else {
    llmResults = cachedLlmResults;
    extractedText = stmt.extractedText;
    llmOnline = true;
  }

  if (!extractedText) {
    const pages = await extractTextPages(buffer);
    extractedText = pages.join("\n\n").trim();
  }

  return {
    statementId: stmt.id,
    bank,
    algorithm: algoResults,
    llm: llmResults,
    extractedText,
    llmAvailable: llmOnline,
    cached: !opts.fresh && cachedLlmResults.length > 0,
  };
}

// ── saveImportedTransactions ─────────────────────────────────────────────────

const importedItemSchema = z.object({
  type: z.enum(["debt", "payment"]),
  personId: z.string().min(1),
  amount: z.coerce.number(),
  date: z.coerce.date(),
  description: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export async function saveImportedTransactions(items: unknown[]): Promise<{ created: number }> {
  const userId = await requireUserId();

  const valid = items
    .map((item) => importedItemSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data);

  if (valid.length === 0) return { created: 0 };

  const personIds = [...new Set(valid.map((i) => i.personId))];
  const owned = await prisma.person.findMany({
    where: { id: { in: personIds }, userId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => p.id));

  let created = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of valid) {
      if (!ownedIds.has(item.personId)) continue;

      const description = (item.description ?? "").slice(0, 500);
      const title = (item.title || description).slice(0, 255) || "Importado";
      const notes = (item.notes ?? "").slice(0, 500);

      if (item.type === "debt") {
        await tx.debt.create({
          data: { personId: item.personId, title, description: notes, amount: item.amount, date: item.date },
        });
      } else {
        await tx.payment.create({
          data: {
            personId: item.personId,
            amount: item.amount,
            description: notes || description,
            date: item.date,
            method: "PIX",
          },
        });
      }
      created++;
    }
  });

  revalidatePath("/");
  return { created };
}

// ── saveLlmFeedback ──────────────────────────────────────────────────────────

const correctionSchema = z.object({
  date: z.coerce.date(),
  description: z.string(),
  amount: z.coerce.number(),
  context: z.string().optional(),
});

export async function saveLlmFeedback(bank: string, corrections: unknown[]): Promise<{ saved: number }> {
  const userId = await requireUserId();

  let saved = 0;
  for (const raw of corrections) {
    const parsed = correctionSchema.safeParse(raw);
    if (!parsed.success) continue;

    await prisma.lLMFeedback.create({
      data: {
        userId,
        bank,
        date: parsed.data.date,
        description: parsed.data.description.slice(0, 255),
        amount: parsed.data.amount,
        context: (parsed.data.context ?? "").slice(0, 2000),
      },
    });
    saved++;
  }

  return { saved };
}

// ── deleteStatement ──────────────────────────────────────────────────────────

export async function deleteStatement(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.statement.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}
