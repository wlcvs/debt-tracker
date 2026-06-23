"use server";

import { signIn, signOut } from "@/auth";

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
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    // Auth.js redirects by throwing — let that propagate normally
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { status: "error", message: "E-mail ou senha incorretos." };
  }
  return { status: "idle" };
}
