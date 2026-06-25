"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const methodSchema = z.enum(["PIX", "CASH"]).default("CASH");

const createPaymentSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  date: z.coerce.date(),
  method: methodSchema,
});

export async function createPayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = createPaymentSchema.parse({
    personId: formData.get("personId"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    method: formData.get("method") || "CASH",
  });

  const person = await prisma.person.findFirst({
    where: { id: parsed.personId, userId: session.user.id },
  });
  if (!person) throw new Error("Person not found");

  await prisma.payment.create({
    data: {
      personId: parsed.personId,
      amount: parsed.amount,
      date: parsed.date,
      method: parsed.method,
    },
  });

  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.payment.deleteMany({
    where: { id, person: { userId: session.user.id } },
  });
  revalidatePath("/");
}

const updatePaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.coerce.number().positive(),
  date: z.coerce.date(),
  method: methodSchema,
});

export async function updatePayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const parsed = updatePaymentSchema.parse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    method: formData.get("method") || "CASH",
  });

  await prisma.payment.updateMany({
    where: { id: parsed.id, person: { userId: session.user.id } },
    data: { amount: parsed.amount, date: parsed.date, method: parsed.method },
  });
  revalidatePath("/");
}
