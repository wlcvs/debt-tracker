"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut();
}

export async function signInAction(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/",
  });
}
