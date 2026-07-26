"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { splitInstallmentAmounts, installmentDate } from "@/lib/installments";
import { requireUserId } from "@/lib/auth-utils";

const DEBT_METHODS = ["PIX", "CASH"] as const;

function resolveDebtMethod(debtMethod: string | undefined): { method: "PIX" | "CASH" | null; creditCardId: string | null } {
  const isEnumMethod = DEBT_METHODS.includes(debtMethod as typeof DEBT_METHODS[number]);
  return {
    method: isEnumMethod ? (debtMethod as "PIX" | "CASH") : null,
    creditCardId: !isEnumMethod && debtMethod ? debtMethod : null,
  };
}

const createDebtSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
  debtMethod: z.string().optional(),
  paid: z.coerce.boolean().default(false),
  installments: z.coerce.number().int().min(1).max(60).default(1),
  installmentDirection: z.enum(["forward", "backward"]).default("forward"),
  paidInstallments: z.string().optional(),
});

export async function createDebt(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createDebtSchema.parse({
    personId: formData.get("personId"),
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

  const person = await prisma.person.findFirst({
    where: { id: parsed.personId, userId },
  });
  if (!person) throw new Error("Person not found");

  const { method, creditCardId } = resolveDebtMethod(parsed.debtMethod);

  if (parsed.installments > 1) {
    const amounts = splitInstallmentAmounts(parsed.amount, parsed.installments);
    const paidIndexes = new Set<number>(parsed.paidInstallments ? JSON.parse(parsed.paidInstallments) : []);
    const installmentGroupId = crypto.randomUUID();

    await prisma.debt.createMany({
      data: amounts.map((amount, i) => {
        const index = i + 1;
        return {
          personId: parsed.personId,
          amount,
          title: `${parsed.title} (${index}/${parsed.installments})`,
          description: parsed.description,
          date: installmentDate(parsed.date, index, parsed.installments, parsed.installmentDirection),
          method,
          creditCardId,
          paid: paidIndexes.has(index),
          installmentGroupId,
          installmentIndex: index,
          installmentTotal: parsed.installments,
        };
      }),
    });
  } else {
    await prisma.debt.create({
      data: {
        personId: parsed.personId,
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

const updateDebtSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive(),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
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
  });

  return debts.map((d) => ({
    id: d.id,
    personId: d.personId,
    amount: Number(d.amount),
    title: d.title,
    date: d.date,
    paid: d.paid,
    installmentIndex: d.installmentIndex,
    installmentTotal: d.installmentTotal,
  }));
}
