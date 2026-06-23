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
  email: string | null;
  accessCode: string;
  totalOwed: number;
  debts: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    isCovered: boolean;
  }[];
  payments: {
    id: string;
    amount: number;
    date: Date;
    method: string;
  }[];
}

export interface DebtorView {
  name: string;
  totalOwed: number;
  debts: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    isCovered: boolean;
  }[];
  payments: {
    id: string;
    amount: number;
    date: Date;
    method: string;
  }[];
}

export type ConsultState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; debtor: DebtorView };

export async function getPersonByAccessCode(
  _prevState: ConsultState,
  formData: FormData
): Promise<ConsultState> {
  const code = (formData.get("accessCode") as string | null)?.trim();

  if (!code) {
    return { status: "error", message: "Digite o código de acesso." };
  }

  const person = await prisma.person.findUnique({
    where: { accessCode: code },
    include: { debts: true, payments: true },
  });

  if (!person) {
    return { status: "error", message: "Código não encontrado." };
  }

  const debts = person.debts.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    description: d.description,
    date: d.date,
  }));

  const totalPaid = person.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const coveredIds = calculateCoveredDebtIds(debts, totalPaid);
  const totalOwed = debts.reduce((sum, d) => sum + d.amount, 0) - totalPaid;

  return {
    status: "success",
    debtor: {
      name: person.name,
      totalOwed,
      debts: debts.map((d) => ({ ...d, isCovered: coveredIds.has(d.id) })),
      payments: person.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.date,
        method: p.method,
      })),
    },
  };
}

export async function deletePerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = formData.get("id") as string;
  await prisma.person.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/");
}

export async function updatePerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = formData.get("id") as string;
  const name = z.string().trim().min(1).parse(formData.get("name"));
  const emailRaw = (formData.get("email") as string | null)?.trim() || null;
  const email = emailRaw ? z.string().email().parse(emailRaw) : null;

  await prisma.person.updateMany({ where: { id, userId: session.user.id }, data: { name, email } });
  revalidatePath("/");
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
      email: person.email,
      accessCode: person.accessCode,
      totalOwed,
      debts: debts.map((debt) => ({
        ...debt,
        isCovered: coveredIds.has(debt.id),
      })),
      payments: person.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        date: p.date,
        method: p.method,
      })),
    };
  });
}

export async function getPersonById(id: string): Promise<PersonWithBalance | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const person = await prisma.person.findFirst({
    where: { id, userId: session.user.id },
    include: { debts: true, payments: true },
  });

  if (!person) return null;

  const debts = person.debts.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    description: d.description,
    date: d.date,
  }));

  const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
  const coveredIds = calculateCoveredDebtIds(debts, totalPaid);
  const totalOwed = debts.reduce((s, d) => s + d.amount, 0) - totalPaid;

  return {
    id: person.id,
    name: person.name,
    email: person.email,
    accessCode: person.accessCode,
    totalOwed,
    debts: debts.map((d) => ({ ...d, isCovered: coveredIds.has(d.id) })),
    payments: person.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.date,
      method: p.method,
    })),
  };
}

export interface OverviewStats {
  totalToReceive: number;
  activeDebtors: number;
  totalDebtors: number;
  totalDebts: number;
  totalPayments: number;
  totalPaid: number;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const people = await prisma.person.findMany({
    where: { userId: session.user.id },
    include: { debts: true, payments: true },
  });

  let totalToReceive = 0;
  let activeDebtors = 0;
  let totalPaid = 0;

  for (const p of people) {
    const debt = p.debts.reduce((s, d) => s + Number(d.amount), 0);
    const paid = p.payments.reduce((s, pay) => s + Number(pay.amount), 0);
    const owed = debt - paid;
    totalToReceive += Math.max(0, owed);
    totalPaid += paid;
    if (owed > 0) activeDebtors++;
  }

  return {
    totalToReceive,
    activeDebtors,
    totalDebtors: people.length,
    totalDebts: people.reduce((s, p) => s + p.debts.length, 0),
    totalPayments: people.reduce((s, p) => s + p.payments.length, 0),
    totalPaid,
  };
}

// Direct lookup by accessCode for the /consultar/[code] route
export async function getDebtorViewByCode(code: string) {
  const person = await prisma.person.findUnique({
    where: { accessCode: code },
    include: { debts: true, payments: true },
  });

  if (!person) return null;

  const debts = person.debts.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    description: d.description,
    date: d.date,
  }));

  const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
  const coveredIds = calculateCoveredDebtIds(debts, totalPaid);
  const totalOwed = debts.reduce((s, d) => s + d.amount, 0) - totalPaid;

  return {
    name: person.name,
    totalOwed,
    debts: debts.map((d) => ({ ...d, isCovered: coveredIds.has(d.id) })),
    payments: person.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.date,
    })),
  };
}