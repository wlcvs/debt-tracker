"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-utils";
import type { Prisma } from "@/generated/prisma/client";

export async function createPerson(formData: FormData): Promise<{ id: string; name: string }> {
  const userId = await requireUserId();

  const name = z.string().trim().min(1, "Name is required").parse(formData.get("name"));

  const person = await prisma.person.create({
    data: { name, userId },
  });

  revalidatePath("/");

  return { id: person.id, name: person.name };
}

export interface PersonWithBalance {
  id: string;
  name: string;
  totalOwed: number;
  totalDebt: number;
  totalPaid: number;
  publicVisible: boolean;
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

type PersonWithRelations = Prisma.PersonGetPayload<{
  include: { debts: { include: { creditCard: true } }; payments: true };
}>;

// Shared by every reader below (admin list/detail views + the public
// no-login view) — each independently mapped debts/payments to this same
// shape and recomputed totalOwed. `id` is omitted here and added back by
// callers that need it (getDebtorViewById's return shape never included
// it — it's the public route's fetcher and has no use for the person's id).
function toPersonWithBalance(person: PersonWithRelations): Omit<PersonWithBalance, "id"> {
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
    name: person.name,
    totalOwed,
    totalDebt,
    totalPaid,
    publicVisible: person.publicVisible,
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

export async function getPersonById(id: string): Promise<PersonWithBalance | null> {
  const userId = await requireUserId();

  const person = await prisma.person.findFirst({
    where: { id, userId },
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  return { id: person.id, ...toPersonWithBalance(person) };
}

export async function deletePerson(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.person.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function updatePerson(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));
  const name = z.string().trim().min(1).parse(formData.get("name"));

  await prisma.person.updateMany({ where: { id, userId }, data: { name } });
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

export interface PersonSummary {
  id: string;
  name: string;
  totalOwed: number;
}

export interface DashboardOverview {
  stats: OverviewStats;
  people: PersonSummary[];
}

// Dashboard-only shape: unlike getPersonById/getDebtorViewById (which need
// every debt/payment row to render detail lists), the dashboard only ever
// shows per-person totals and global counts — so this aggregates in
// Postgres (groupBy/count/aggregate) instead of pulling the whole
// Person -> Debt -> Payment graph over the wire just to sum it in JS.
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const userId = await requireUserId();

  const [people, unpaidDebtSums, paymentSums, totalDebts, paymentAgg] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.debt.groupBy({
      by: ["personId"],
      where: { person: { userId }, paid: false },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["personId"],
      where: { person: { userId } },
      _sum: { amount: true },
    }),
    prisma.debt.count({ where: { person: { userId } } }),
    prisma.payment.aggregate({
      where: { person: { userId } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const debtByPerson = new Map(unpaidDebtSums.map((d) => [d.personId, Number(d._sum.amount ?? 0)]));
  const paidByPerson = new Map(paymentSums.map((p) => [p.personId, Number(p._sum.amount ?? 0)]));

  let totalToReceive = 0;
  let activeDebtors = 0;
  const peopleSummary = people.map((p) => {
    const totalOwed = (debtByPerson.get(p.id) ?? 0) - (paidByPerson.get(p.id) ?? 0);
    if (totalOwed > 0) {
      totalToReceive += totalOwed;
      activeDebtors++;
    }
    return { id: p.id, name: p.name, totalOwed };
  });

  return {
    people: peopleSummary,
    stats: {
      totalToReceive,
      activeDebtors,
      totalDebtors: people.length,
      totalDebts,
      totalPayments: paymentAgg._count,
      totalPaid: Number(paymentAgg._sum.amount ?? 0),
    },
  };
}

export async function getDebtorViewById(id: string) {
  const person = await prisma.person.findUnique({
    where: { id, publicVisible: true },
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  return toPersonWithBalance(person);
}

export async function togglePersonPublicVisibility(formData: FormData) {
  const userId = await requireUserId();

  const id = z.string().min(1).parse(formData.get("id"));

  const person = await prisma.person.findFirst({ where: { id, userId } });
  if (!person) throw new Error("Person not found");

  await prisma.person.update({
    where: { id },
    data: { publicVisible: !person.publicVisible },
  });
  revalidatePath("/");
}
