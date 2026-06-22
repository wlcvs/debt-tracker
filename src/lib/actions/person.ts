"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

import { calculateCoveredDebtIds } from "@/lib/debt-allocation";

const createPersonSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

function generateAccessCode(): string {
  return randomBytes(6).toString("hex"); // 12 caracteres, ex: "a1b2c3d4e5f6"
}

export async function createPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const parsed = createPersonSchema.parse({
    name: formData.get("name"),
  });

  await prisma.person.create({
    data: {
      name: parsed.name,
      userId: session.user.id,
      accessCode: generateAccessCode(),
    },
  });

  revalidatePath("/");
}

export interface PersonWithBalance {
  id: string;
  name: string;
  accessCode: string;
  totalOwed: number;
  debts: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    isCovered: boolean;
  }[]
}

export async function getPeopleWithBalances(): Promise<PersonWithBalance[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const people = await prisma.person.findMany({
    where: { userId: session.user.id },
    include: { debts: true, payments: true },
    orderBy: { name: "asc" },
  });

  return people.map((person) => {
    const debts = person.debts.map((debt) => ({
      id: debt.id,
      amount: Number(debt.amount),
      description: debt.description,
      date: debt.date,
    }));

    const totalPaid = person.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const coveredIds = calculateCoveredDebtIds(debts, totalPaid);

    const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const totalOwed = totalDebt - totalPaid;

    return {
      id: person.id,
      name: person.name,
      accessCode: person.accessCode,
      totalOwed,
      debts: debts.map((debt) => ({
        ...debt,
        isCovered: coveredIds.has(debt.id),
      })),
    };
  });
}