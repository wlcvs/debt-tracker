"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createPerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = z.string().trim().min(1, "Name is required").parse(formData.get("name"));

  await prisma.person.create({
    data: { name, userId: session.user.id },
  });

  revalidatePath("/");
}

export interface PersonWithBalance {
  id: string;
  name: string;
  totalOwed: number;
  debts: {
    id: string;
    amount: number;
    title: string;
    description: string;
    paid: boolean;
    date: Date;
    method: string | null;
    creditCardId: string | null;
    creditCardLabel: string | null;
    installmentGroupId: string | null;
    installmentIndex: number | null;
    installmentTotal: number | null;
  }[];
  payments: {
    id: string;
    amount: number;
    description: string;
    date: Date;
    method: string;
  }[];
}

export async function getPeopleWithBalances(): Promise<PersonWithBalance[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const people = await prisma.person.findMany({
    where: { userId: session.user.id },
    include: { debts: { include: { creditCard: true } }, payments: true },
    orderBy: { name: "asc" },
  });

  return people.map((person) => {
    const debts = person.debts.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      title: d.title,
      description: d.description,
      paid: d.paid,
      date: d.date,
      method: d.method,
      creditCardId: d.creditCardId,
      creditCardLabel: d.creditCard?.label ?? null,
      installmentGroupId: d.installmentGroupId,
      installmentIndex: d.installmentIndex,
      installmentTotal: d.installmentTotal,
    }));
    const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalDebt = debts.reduce((s, d) => s + (d.paid ? 0 : d.amount), 0);
    const totalOwed = totalDebt - totalPaid;

    return {
      id: person.id,
      name: person.name,
      totalOwed,
      debts,
      payments: person.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        description: p.description,
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
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  const debts = person.debts.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    title: d.title,
    description: d.description,
    paid: d.paid,
    date: d.date,
    method: d.method,
    creditCardId: d.creditCardId,
    creditCardLabel: d.creditCard?.label ?? null,
    installmentGroupId: d.installmentGroupId,
    installmentIndex: d.installmentIndex,
    installmentTotal: d.installmentTotal,
  }));
  const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDebt = debts.reduce((s, d) => s + (d.paid ? 0 : d.amount), 0);
  const totalOwed = totalDebt - totalPaid;

  return {
    id: person.id,
    name: person.name,
    totalOwed,
    debts,
    payments: person.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      description: p.description,
      date: p.date,
      method: p.method,
    })),
  };
}

export async function deletePerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.person.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/");
}

export async function updatePerson(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const id = z.string().min(1).parse(formData.get("id"));
  const name = z.string().trim().min(1).parse(formData.get("name"));

  await prisma.person.updateMany({ where: { id, userId: session.user.id }, data: { name } });
  revalidatePath("/");
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
    const debt = p.debts.reduce((s, d) => s + (d.paid ? 0 : Number(d.amount)), 0);
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

export async function getDebtorViewById(id: string) {
  const person = await prisma.person.findUnique({
    where: { id },
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDebt = person.debts.reduce((s, d) => s + (d.paid ? 0 : Number(d.amount)), 0);
  const totalOwed = totalDebt - totalPaid;

  return {
    name: person.name,
    totalOwed,
    debts: person.debts.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      title: d.title,
      description: d.description,
      paid: d.paid,
      date: d.date,
      method: d.method,
      creditCardId: d.creditCardId,
      creditCardLabel: d.creditCard?.label ?? null,
      installmentGroupId: d.installmentGroupId,
      installmentIndex: d.installmentIndex,
      installmentTotal: d.installmentTotal,
    })),
    payments: person.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      description: p.description,
      date: p.date,
      method: p.method,
    })),
  };
}
