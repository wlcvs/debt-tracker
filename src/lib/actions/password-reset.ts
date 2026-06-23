"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { hash } from "bcryptjs";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ResetRequestState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export type ResetPasswordState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) {
    return { status: "error", message: "E-mail inválido." };
  }

  const user = await prisma.user.findUnique({ where: { email: email.data } });

  // Return success even when user doesn't exist — avoids leaking which emails are registered.
  if (!user) {
    return { status: "success" };
  }

  // Invalidate existing tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

  await resend.emails.send({
    from: "Debt Tracker <noreply@wlcsv.dev>",
    to: email.data,
    subject: "Redefinição de senha",
    html: `
      <p>Você solicitou a redefinição de senha.</p>
      <p><a href="${resetUrl}">Clique aqui para redefinir</a></p>
      <p>O link expira em 1 hora. Se não foi você, ignore este e-mail.</p>
    `,
  });

  return { status: "success" };
}

export async function resetPassword(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const passwordSchema = z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.");

  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record || record.expiresAt < new Date()) {
    return { status: "error", message: "Link inválido ou expirado." };
  }

  const passwordHash = await hash(parsed.data, 12);

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.delete({ where: { token } });

  return { status: "success" };
}
