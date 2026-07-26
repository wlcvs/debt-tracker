"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-utils";

const methodSchema = z.enum(["PIX", "CASH"]).default("CASH");

const createPaymentSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
  method: methodSchema,
});

export async function createPayment(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createPaymentSchema.parse({
    personId: formData.get("personId"),
    amount: formData.get("amount"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    method: formData.get("method") ?? undefined,
  });

  const person = await prisma.person.findFirst({
    where: { id: parsed.personId, userId },
  });
  if (!person) throw new Error("Person not found");

  await prisma.payment.create({
    data: {
      personId: parsed.personId,
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
  amount: z.coerce.number().positive(),
  description: z.string().trim().default(""),
  date: z.coerce.date(),
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
