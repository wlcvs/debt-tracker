"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function signOutAction() {
  await signOut();
}

export type SignInState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const ip = await getClientIp();
  const { allowed } = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return { status: "error", message: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }

  try {
    await signIn("admin", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: "error", message: "E-mail ou senha incorretos." };
    }
    throw err;
  }
  redirect("/");
}
