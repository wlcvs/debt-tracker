"use server";

import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

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
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { status: "error", message: "Preencha todos os campos." };

  try {
    await signIn("admin", { ...parsed.data, redirectTo: "/" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: "error", message: "E-mail ou senha incorretos." };
    }
    throw err;
  }
  redirect("/");
}
