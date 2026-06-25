"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const DEBT_METHODS = ["PIX", "CASH"] as const;

const createDebtSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().min(1, "Description is required"),
  date: z.coerce.date(),
  debtMethod: z.string().optional(),
});

export async function createDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createDebtSchema.parse({
    personId: formData.get("personId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
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
  description: z.string().trim().min(1),
  date: z.coerce.date(),
});

export async function updateDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updateDebtSchema.parse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    date: formData.get("date"),
  });

  await prisma.debt.updateMany({
    where: { id: parsed.id, person: { userId: session.user.id } },
    data: { amount: parsed.amount, description: parsed.description, date: parsed.date },
  });
  revalidatePath("/");
}
