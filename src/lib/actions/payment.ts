"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-utils";
import { amountSchema, dateSchema } from "@/lib/schemas";

const methodSchema = z.enum(["PIX", "CASH"]).default("CASH");

const createPaymentSchema = z.object({
  personAccessCode: z.string().min(1),
  amount: amountSchema("Amount must be greater than zero"),
  description: z.string().trim().default(""),
  date: dateSchema,
  method: methodSchema,
});

export async function createPayment(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createPaymentSchema.parse({
    personAccessCode: formData.get("personAccessCode"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    method: formData.get("method") ?? undefined,
  });

  // Doubles as the ownership check and the accessCode -> internal id
  // translation (see createDebt for the same pattern).
  const person = await prisma.person.findFirst({
    where: { accessCode: parsed.personAccessCode, userId },
  });
  if (!person) throw new Error("Person not found");

  await prisma.payment.create({
    data: {
      personId: person.id,
      amount: parsed.amount,
      description: parsed.description,
      date: parsed.date,
      method: parsed.method,
    },
  });

  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.payment.deleteMany({
    where: { id, person: { userId } },
  });
  revalidatePath("/");
}

const updatePaymentSchema = z.object({
  id: z.string().min(1),
  amount: amountSchema(),
  description: z.string().trim().default(""),
  date: dateSchema,
  method: methodSchema,
});

export async function updatePayment(formData: FormData) {
  const userId = await requireUserId();

  const parsed = updatePaymentSchema.parse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    method: formData.get("method") ?? undefined,
  });

  await prisma.payment.updateMany({
    where: { id: parsed.id, person: { userId } },
    data: { amount: parsed.amount, description: parsed.description, date: parsed.date, method: parsed.method },
  });
  revalidatePath("/");
}
