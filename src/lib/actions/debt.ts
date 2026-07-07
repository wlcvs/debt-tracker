"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const DEBT_METHODS = ["PIX", "CASH"] as const;

const createDebtSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
  debtMethod: z.string().optional(),
});

export async function createDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createDebtSchema.parse({
    personId: formData.get("personId"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    debtMethod: formData.get("debtMethod") ?? undefined,
  });

  const person = await prisma.person.findFirst({
    where: { id: parsed.personId, userId: session.user.id },
  });
  if (!person) throw new Error("Person not found");

  const isEnumMethod = DEBT_METHODS.includes(parsed.debtMethod as typeof DEBT_METHODS[number]);
  const method = isEnumMethod ? (parsed.debtMethod as "PIX" | "CASH") : null;
  const creditCardId = !isEnumMethod && parsed.debtMethod ? parsed.debtMethod : null;

  await prisma.debt.create({
    data: {
      personId: parsed.personId,
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

export async function deleteDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.debt.deleteMany({
    where: { id, person: { userId: session.user.id } },
  });
  revalidatePath("/");
}

const updateDebtSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive(),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
});

export async function updateDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateDebtSchema.parse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
  });

  await prisma.debt.updateMany({
    where: { id: parsed.id, person: { userId: session.user.id } },
    data: { amount: parsed.amount, title: parsed.title, description: parsed.description, date: parsed.date },
  });
  revalidatePath("/");
}

export async function toggleDebtPaid(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().min(1).parse(formData.get("id"));

  const debt = await prisma.debt.findFirst({
    where: { id, person: { userId: session.user.id } },
  });
  if (!debt) throw new Error("Debt not found");

  await prisma.debt.update({ where: { id }, data: { paid: !debt.paid } });
  revalidatePath("/");
}
