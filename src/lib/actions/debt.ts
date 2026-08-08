"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  splitInstallmentAmounts,
  installmentDate,
  buildInstallments,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
} from "@/lib/installments";
import { requireUserId } from "@/lib/auth-utils";
import { amountSchema, dateSchema } from "@/lib/schemas";
import { resolveDebtMethod } from "@/lib/debt-method";

const createDebtSchema = z.object({
  personAccessCode: z.string().min(1),
  amount: amountSchema("Amount must be greater than zero"),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  date: dateSchema,
  debtMethod: z.string().optional(),
  paid: z.coerce.boolean().default(false),
  // Deliberately no .default(1): presence, not the value, is what decides
  // between "one plain debt" and "an installment group". A form that never
  // opened the Parcelar panel omits the field entirely; one that submits
  // installments=1 wants a real 1/1 group (title suffix, badge, group id).
  installments: z.coerce.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS).optional(),
  installmentDirection: z.enum(["forward", "backward"]).default("forward"),
  paidInstallments: z.string().optional(),
});

export async function createDebt(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createDebtSchema.parse({
    personAccessCode: formData.get("personAccessCode"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    debtMethod: formData.get("debtMethod") ?? undefined,
    paid: formData.get("paid") ?? undefined,
    installments: formData.get("installments") ?? undefined,
    installmentDirection: formData.get("installmentDirection") ?? undefined,
    paidInstallments: formData.get("paidInstallments") ?? undefined,
  });

  // This lookup already existed as the ownership check; it now doubles as the
  // accessCode -> internal id translation, so the DB id never has to be sent
  // to the client just to come back on the next write.
  const person = await prisma.person.findFirst({
    where: { accessCode: parsed.personAccessCode, userId },
  });
  if (!person) throw new Error("Person not found");

  const { method, creditCardId } = resolveDebtMethod(parsed.debtMethod);

  if (parsed.installments !== undefined) {
    const total = parsed.installments;
    const amounts = splitInstallmentAmounts(parsed.amount, total);
    const paidIndexes = new Set<number>(parsed.paidInstallments ? JSON.parse(parsed.paidInstallments) : []);
    const installmentGroupId = crypto.randomUUID();

    await prisma.debt.createMany({
      data: amounts.map((amount, i) => {
        const index = i + 1;
        return {
          personId: person.id,
          amount,
          title: `${parsed.title} (${index}/${total})`,
          description: parsed.description,
          date: installmentDate(parsed.date, index, total, parsed.installmentDirection),
          method,
          creditCardId,
          paid: paidIndexes.has(index),
          installmentGroupId,
          installmentIndex: index,
          installmentTotal: total,
        };
      }),
    });
  } else {
    await prisma.debt.create({
      data: {
        personId: person.id,
        amount: parsed.amount,
        title: parsed.title,
        description: parsed.description,
        date: parsed.date,
        method,
        creditCardId,
        paid: parsed.paid,
      },
    });
  }

  revalidatePath("/");
}

export async function deleteDebt(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.debt.deleteMany({
    where: { id, person: { userId } },
  });
  revalidatePath("/");
}

export async function deleteDebtInstallmentGroup(formData: FormData) {
  const userId = await requireUserId();

  const installmentGroupId = z.string().min(1).parse(formData.get("installmentGroupId"));
  await prisma.debt.deleteMany({
    where: { installmentGroupId, person: { userId } },
  });
  revalidatePath("/");
}

const updateDebtGroupSchema = z.object({
  installmentGroupId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  // The purchase's total, not one installment's — it is re-split below.
  amount: amountSchema("Amount must be greater than zero"),
  // The first installment's date. Unlike createDebt there's no direction:
  // "backward" exists there to log an already-settled purchase from its last
  // installment, and once the group exists, setting the first date does the
  // same job without a second control.
  date: dateSchema,
  installments: z.coerce.number().int().min(MIN_INSTALLMENTS).max(MAX_INSTALLMENTS),
  debtMethod: z.string().optional(),
});

/**
 * Edits a parceled purchase as the single thing it is.
 *
 * debt-detail-modal.tsx hides "Editar" for a debt inside a group, since
 * editing one installment in isolation would leave the group inconsistent —
 * which left a typo in the title, the total or the count with no fix but
 * delete-and-recreate. This rewrites the whole group instead.
 *
 * Surviving rows are updated in place rather than dropped and recreated, so
 * each keeps its own `paid` flag: shrinking the count deletes only the extra
 * rows, growing it appends unpaid ones. Note that a `Payment` recorded for a
 * removed installment stays — payments carry no FK to a debt, same as after
 * deleteDebtInstallmentGroup.
 */
export async function updateDebtInstallmentGroup(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateDebtGroupSchema.parse({
    installmentGroupId: formData.get("installmentGroupId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    amount: formData.get("amount"),
    date: formData.get("date"),
    installments: formData.get("installments"),
    debtMethod: formData.get("debtMethod") ?? undefined,
  });

  // Doubles as the ownership check and as the source of personId for any rows
  // being added — the same shape createDebt uses for its accessCode lookup.
  const existing = await prisma.debt.findMany({
    where: { installmentGroupId: parsed.installmentGroupId, person: { userId } },
    orderBy: { installmentIndex: "asc" },
  });
  if (existing.length === 0) throw new Error("Installment group not found");

  const total = parsed.installments;
  const { method, creditCardId } = resolveDebtMethod(parsed.debtMethod);
  const rows = buildInstallments(parsed.amount, total, parsed.date);
  const shared = { description: parsed.description, method, creditCardId, installmentTotal: total };

  await prisma.$transaction(async (tx) => {
    const kept = existing.slice(0, total);

    await Promise.all(
      kept.map((debt, i) =>
        tx.debt.update({
          where: { id: debt.id },
          data: {
            ...shared,
            amount: rows[i].amount,
            title: `${parsed.title} (${rows[i].index}/${total})`,
            date: rows[i].date,
            // paid is deliberately absent: an installment that survives the
            // edit keeps whatever state it already had.
            installmentIndex: rows[i].index,
          },
        })
      )
    );

    if (existing.length > total) {
      await tx.debt.deleteMany({
        where: { id: { in: existing.slice(total).map((d) => d.id) } },
      });
    }

    if (rows.length > existing.length) {
      await tx.debt.createMany({
        data: rows.slice(existing.length).map((row) => ({
          ...shared,
          personId: existing[0].personId,
          amount: row.amount,
          title: `${parsed.title} (${row.index}/${total})`,
          date: row.date,
          paid: false,
          installmentGroupId: parsed.installmentGroupId,
          installmentIndex: row.index,
        })),
      });
    }
  });

  revalidatePath("/");
}

const updateDebtSchema = z.object({
  id: z.string().min(1),
  amount: amountSchema(),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  date: dateSchema,
  debtMethod: z.string().optional(),
});

export async function updateDebt(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updateDebtSchema.parse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    debtMethod: formData.get("debtMethod") ?? undefined,
  });

  const { method, creditCardId } = resolveDebtMethod(parsed.debtMethod);

  await prisma.debt.updateMany({
    where: { id: parsed.id, person: { userId } },
    data: {
      amount: parsed.amount,
      title: parsed.title,
      description: parsed.description,
      date: parsed.date,
      method,
      creditCardId,
    },
  });
  revalidatePath("/");
}

export async function toggleDebtPaid(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));

  const debt = await prisma.debt.findFirst({
    where: { id, person: { userId } },
  });
  if (!debt) throw new Error("Debt not found");

  await prisma.debt.update({ where: { id }, data: { paid: !debt.paid } });
  revalidatePath("/");
}

export async function toggleDebtsPaidBulk(formData: FormData) {
  const userId = await requireUserId();

  const idsRaw = z.string().min(1).parse(formData.get("debtIds"));
  const ids = z.array(z.string().min(1)).min(1).parse(JSON.parse(idsRaw));

  await prisma.debt.updateMany({
    where: { id: { in: ids }, person: { userId } },
    data: { paid: true },
  });
  revalidatePath("/");
}

export async function getDebtInstallmentGroup(installmentGroupId: string) {
  const userId = await requireUserId();

  const debts = await prisma.debt.findMany({
    where: { installmentGroupId, person: { userId } },
    orderBy: { installmentIndex: "asc" },
    include: { person: { select: { accessCode: true } } },
  });

  return debts.map((d) => ({
    id: d.id,
    // The panel feeds this straight back into createPayment — it must be the
    // accessCode, never d.personId.
    personAccessCode: d.person.accessCode,
    amount: Number(d.amount),
    title: d.title,
    // description/method/creditCardId are here for the panel's edit form,
    // which prefills the whole purchase — they're identical across the group.
    description: d.description,
    method: d.method,
    creditCardId: d.creditCardId,
    date: d.date,
    paid: d.paid,
    installmentIndex: d.installmentIndex,
    installmentTotal: d.installmentTotal,
  }));
}
