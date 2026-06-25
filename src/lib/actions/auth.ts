"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

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
