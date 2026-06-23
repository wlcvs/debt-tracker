"use server";

import { signIn, signOut } from "@/auth";
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
