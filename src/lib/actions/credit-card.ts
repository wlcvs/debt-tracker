"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-utils";

const createCreditCardSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
});

export async function createCreditCard(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createCreditCardSchema.parse({
    label: formData.get("label"),
  });

  await prisma.creditCard.create({
    data: {
      label: parsed.label,
      userId,
    },
  });

  revalidatePath("/");
}

export async function deleteCreditCard(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));

  const debtCount = await prisma.debt.count({ where: { creditCardId: id } });
  if (debtCount > 0) {
    throw new Error("Este cartão possui dívidas registradas e não pode ser excluído.");
  }

  await prisma.creditCard.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function getCreditCards() {
  const userId = await requireUserId();

  return prisma.creditCard.findMany({
    where: { userId },
    orderBy: { label: "asc" },
  });
}
