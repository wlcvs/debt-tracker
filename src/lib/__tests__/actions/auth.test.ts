import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// The real "next-auth" package pulls in "next/server" via its env-detection
// module, which fails to resolve in this Vitest (node) environment. We only
// need AuthError's class identity for `instanceof` checks, so provide a
// minimal stand-in instead of loading the real package.
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signInAction, signOutAction } from "@/lib/actions/auth";

const mockSignIn = vi.mocked(signIn);
const mockSignOut = vi.mocked(signOut);
const mockRedirect = vi.mocked(redirect);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── signOutAction ─────────────────────────────────────────────────────────────

describe("signOutAction", () => {
  it("calls signOut once with no args", async () => {
    mockSignOut.mockResolvedValue(undefined as never);
    await signOutAction();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith();
  });

  it("propagates if signOut rejects", async () => {
    mockSignOut.mockRejectedValue(new Error("boom"));
    await expect(signOutAction()).rejects.toThrow("boom");
  });
});

// ── signInAction ──────────────────────────────────────────────────────────────

describe("signInAction", () => {
  it("returns validation error when email is missing", async () => {
    const form = new FormData();
    form.set("password", "secret123");
    const result = await signInAction({ status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: "Preencha todos os campos." });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns validation error when password is missing", async () => {
    const form = new FormData();
    form.set("email", "admin@example.com");
    const result = await signInAction({ status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: "Preencha todos os campos." });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid email format", async () => {
    const form = new FormData();
    form.set("email", "not-an-email");
    form.set("password", "secret123");
    const result = await signInAction({ status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: "Preencha todos os campos." });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("returns validation error for empty string password", async () => {
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "");
    const result = await signInAction({ status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: "Preencha todos os campos." });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("signs in and redirects on valid credentials", async () => {
    mockSignIn.mockResolvedValue(undefined as never);
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "secret123");
    await signInAction({ status: "idle" }, form);

    expect(mockSignIn).toHaveBeenCalledWith("admin", {
      email: "admin@example.com",
      password: "secret123",
      redirectTo: "/",
    });
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("returns friendly error message when signIn throws AuthError", async () => {
    mockSignIn.mockRejectedValue(new AuthError("invalid credentials"));
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "wrongpass");
    const result = await signInAction({ status: "idle" }, form);

    expect(result).toEqual({ status: "error", message: "E-mail ou senha incorretos." });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("propagates a generic error from signIn", async () => {
    mockSignIn.mockRejectedValue(new Error("network down"));
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "secret123");

    await expect(signInAction({ status: "idle" }, form)).rejects.toThrow("network down");
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
