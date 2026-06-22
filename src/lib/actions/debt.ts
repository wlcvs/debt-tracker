"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const createDebtSchema = z.object({
  personId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().min(1, "Description is required"),
  date: z.coerce.date(),
  creditCardId: z.string().optional(),
});

export async function createDebt(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const rawCreditCardId = formData.get("creditCardId");

  const parsed = createDebtSchema.parse({
    personId: formData.get("personId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    date: formData.get("date"),
    creditCardId: rawCreditCardId ? rawCreditCardId : undefined,
  });

  // Ensure the person belongs to the logged-in user (avoid cross-user data access)
  const person = await prisma.person.findFirst({
    where: { id: parsed.personId, userId: session.user.id },
  });
  if (!person) {
    throw new Error("Person not found");
  }

  await prisma.debt.create({
    data: {
      personId: parsed.personId,
      amount: parsed.amount,
      description: parsed.description,
      date: parsed.date,
      creditCardId: parsed.creditCardId || null,
    },
  });

  revalidatePath("/");
}