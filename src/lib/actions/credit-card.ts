"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const createCreditCardSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
});

export async function createCreditCard(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const parsed = createCreditCardSchema.parse({
    label: formData.get("label"),
  });

  await prisma.creditCard.create({
    data: {
      label: parsed.label,
      userId: session.user.id,
    },
  });

  revalidatePath("/");
}

export async function getCreditCards() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return prisma.creditCard.findMany({
    where: { userId: session.user.id },
    orderBy: { label: "asc" },
  });
}