"use server";

import { z } from "zod";
import { hash } from "bcryptjs";
import { signIn, signOut, auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { calculateCoveredDebtIds } from "@/lib/debt-allocation";

export type RegisterState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export type DebtorSignInState =
  | { status: "idle" }
  | { status: "error"; message: string };

const registerSchema = z.object({
  accessCode: z.string().trim().min(1, "Código obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length >= 10 && s.length <= 11, "Celular inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  emailNotifications: z.boolean().default(false),
});

export async function debtorRegisterAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const ip = await getClientIp();
  const { allowed } = checkRateLimit(`debtor-register:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return { status: "error", message: "Muitas tentativas. Aguarde 15 minutos." };
  }

  const parsed = registerSchema.safeParse({
    accessCode: formData.get("accessCode"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    emailNotifications: formData.get("emailNotifications") === "on",
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const person = await prisma.person.findUnique({
    where: { accessCode: parsed.data.accessCode },
  });

  if (!person) {
    return { status: "error", message: "Código de acesso inválido." };
  }

  if (person.passwordHash) {
    return {
      status: "error",
      message: "Esta conta já tem cadastro. Use a página de login.",
    };
  }

  const emailInUse = await prisma.person.findUnique({
    where: { email: parsed.data.email },
  });
  if (emailInUse) {
    return { status: "error", message: "Este e-mail já está cadastrado." };
  }

  const passwordHash = await hash(parsed.data.password, 12);

  await prisma.person.update({
    where: { id: person.id },
    data: {
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      emailNotifications: parsed.data.emailNotifications,
    },
  });

  return { status: "success" };
}

export async function debtorSignInAction(
  _prev: DebtorSignInState,
  formData: FormData
): Promise<DebtorSignInState> {
  const ip = await getClientIp();
  const { allowed } = checkRateLimit(`debtor-login:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return { status: "error", message: "Muitas tentativas. Aguarde 15 minutos." };
  }

  try {
    await signIn("debtor", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/minha-conta",
    });
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { status: "error", message: "E-mail ou senha incorretos." };
  }
  return { status: "idle" };
}

export async function debtorSignOutAction() {
  await signOut({ redirectTo: "/debtor/login" });
}

export async function getMyAccount() {
  const session = await auth();
  if (session?.user?.role !== "debtor") throw new Error("Not authenticated as debtor");

  const person = await prisma.person.findUnique({
    where: { id: session.user.id },
    include: { debts: true, payments: true },
  });

  if (!person) throw new Error("Person not found");

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
    phone: person.phone,
    emailNotifications: person.emailNotifications,
    totalOwed,
    debts: debts.map((d) => ({ ...d, isCovered: coveredIds.has(d.id) })),
    payments: person.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      date: p.date,
      method: p.method,
      debtId: p.debtId ?? null,
    })),
  };
}

export async function updateEmailNotifications(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "debtor") throw new Error("Not authenticated as debtor");

  const enabled = formData.get("emailNotifications") === "on";

  await prisma.person.update({
    where: { id: session.user.id },
    data: { emailNotifications: enabled },
  });
}
