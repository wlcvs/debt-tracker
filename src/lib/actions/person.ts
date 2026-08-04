"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-utils";
import { generateAccessCode } from "@/lib/access-code";
import type { Prisma } from "@/generated/prisma/client";

export async function createPerson(formData: FormData): Promise<{ accessCode: string; name: string }> {
  const userId = await requireUserId();

  const name = z.string().trim().min(1, "Name is required").parse(formData.get("name"));

  const person = await prisma.person.create({
    data: { name, userId, accessCode: generateAccessCode() },
  });

  revalidatePath("/");

  return { accessCode: person.accessCode, name: person.name };
}

export interface PersonWithBalance {
  name: string;
  accessCode: string;
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
// shape and recomputed totalOwed. Deliberately never carries person.id:
// the DB id is internal, and every client-facing identifier for a person is
// their accessCode (see the rule in CLAUDE.md).
function toPersonWithBalance(person: PersonWithRelations): PersonWithBalance {
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
  // Floored at zero: overpaying (or paying when nothing is owed) used to render
  // as "R$ -300,00" in the header. Nothing is owed is nothing is owed — the
  // amount already paid is shown on its own line instead.
  const totalOwed = Math.max(0, totalDebt - totalPaid);

  return {
    name: person.name,
    accessCode: person.accessCode,
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

export async function getPersonByAccessCode(code: string): Promise<PersonWithBalance | null> {
  const userId = await requireUserId();

  const person = await prisma.person.findFirst({
    where: { accessCode: code, userId },
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  return toPersonWithBalance(person);
}

export async function deletePerson(formData: FormData) {
  const userId = await requireUserId();

  const accessCode = z.string().min(1).parse(formData.get("accessCode"));
  await prisma.person.deleteMany({ where: { accessCode, userId } });
  revalidatePath("/");
}

export async function updatePerson(formData: FormData) {
  const userId = await requireUserId();

  const accessCode = z.string().min(1).parse(formData.get("accessCode"));
  const name = z.string().trim().min(1).parse(formData.get("name"));

  await prisma.person.updateMany({ where: { accessCode, userId }, data: { name } });
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

// No balance field: the dashboard list shows names only. The per-person total
// is still computed below, but only to feed totalToReceive/activeDebtors.
export interface PersonSummary {
  accessCode: string;
  name: string;
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

  const [people, unpaidDebtSums, paymentSums, standaloneDebts, installmentGroups, paymentAgg] =
    await Promise.all([
      // id is selected only to join the groupBy aggregates below — it never
      // reaches the returned PersonSummary.
      prisma.person.findMany({
        where: { userId },
        select: { id: true, name: true, accessCode: true },
        orderBy: { name: "asc" },
      }),
      // Money stays row-based: each installment row carries its own share of
      // the purchase, so summing rows is exactly right here.
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
      // The *count*, unlike the sums, treats a parceled purchase as one debt —
      // a 10x purchase is one thing the person bought, not ten. Prisma has no
      // distinct on count(), hence the split; both run inside this Promise.all,
      // and the group lookup rides the existing @@index([installmentGroupId]).
      prisma.debt.count({ where: { person: { userId }, installmentGroupId: null } }),
      prisma.debt.findMany({
        where: { person: { userId }, installmentGroupId: { not: null } },
        select: { installmentGroupId: true },
        distinct: ["installmentGroupId"],
      }),
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
    return { accessCode: p.accessCode, name: p.name };
  });

  return {
    people: peopleSummary,
    stats: {
      totalToReceive,
      activeDebtors,
      totalDebtors: people.length,
      totalDebts: standaloneDebts + installmentGroups.length,
      totalPayments: paymentAgg._count,
      totalPaid: Number(paymentAgg._sum.amount ?? 0),
    },
  };
}

// Resolved by accessCode, never by the person's DB id — the id is internal and
// never leaves the server at all (see the rule in CLAUDE.md).
export async function getDebtorViewById(code: string) {
  const person = await prisma.person.findUnique({
    where: { accessCode: code, publicVisible: true },
    include: { debts: { include: { creditCard: true } }, payments: true },
  });

  if (!person) return null;

  return toPersonWithBalance(person);
}

export async function togglePersonPublicVisibility(formData: FormData) {
  const userId = await requireUserId();

  const accessCode = z.string().min(1).parse(formData.get("accessCode"));

  const person = await prisma.person.findFirst({ where: { accessCode, userId } });
  if (!person) throw new Error("Person not found");

  await prisma.person.update({
    where: { id: person.id },
    data: { publicVisible: !person.publicVisible },
  });
  revalidatePath("/");
}
