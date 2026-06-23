import { describe, it, expect, vi, beforeEach } from "vitest";
import "../helpers/prisma-mock";
import { prismaMock } from "../helpers/prisma-mock";

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn().mockResolvedValue({ data: {}, error: null }) };
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

const extended = prismaMock as typeof prismaMock & {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  passwordResetToken: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

import { requestPasswordReset, resetPassword } from "@/lib/actions/password-reset";

beforeEach(() => {
  vi.clearAllMocks();
  extended.user = {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  };
  extended.passwordResetToken = {
    create: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
  };
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

// ── requestPasswordReset ────────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  const idle = { status: "idle" as const };

  it("returns error on invalid email", async () => {
    const form = new FormData();
    form.set("email", "not-an-email");
    const result = await requestPasswordReset(idle, form);
    expect(result).toMatchObject({ status: "error" });
  });

  it("returns success even when user does not exist (no enumeration)", async () => {
    extended.user.findUnique.mockResolvedValue(null);
    const form = new FormData();
    form.set("email", "notfound@test.com");
    const result = await requestPasswordReset(idle, form);
    expect(result).toMatchObject({ status: "success" });
    expect(extended.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates token and sends email when user exists", async () => {
    extended.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    const form = new FormData();
    form.set("email", "user@test.com");
    const result = await requestPasswordReset(idle, form);
    expect(result).toMatchObject({ status: "success" });
    expect(extended.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(extended.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      })
    );
  });
});

// ── resetPassword ───────────────────────────────────────────────────────────

describe("resetPassword", () => {
  const idle = { status: "idle" as const };

  it("returns error when password is too short", async () => {
    const form = new FormData();
    form.set("password", "abc");
    const result = await resetPassword("some-token", idle, form);
    expect(result).toMatchObject({ status: "error", message: expect.stringContaining("8") });
  });

  it("returns error when token is not found", async () => {
    extended.passwordResetToken.findUnique.mockResolvedValue(null);
    const form = new FormData();
    form.set("password", "newpassword123");
    const result = await resetPassword("bad-token", idle, form);
    expect(result).toMatchObject({ status: "error", message: "Link inválido ou expirado." });
  });

  it("returns error when token is expired", async () => {
    extended.passwordResetToken.findUnique.mockResolvedValue({
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1000),
    });
    const form = new FormData();
    form.set("password", "newpassword123");
    const result = await resetPassword("tok", idle, form);
    expect(result).toMatchObject({ status: "error", message: "Link inválido ou expirado." });
  });

  it("updates password and deletes token on success", async () => {
    extended.passwordResetToken.findUnique.mockResolvedValue({
      token: "valid-tok",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const form = new FormData();
    form.set("password", "newsecurepass");
    const result = await resetPassword("valid-tok", idle, form);
    expect(result).toMatchObject({ status: "success" });
    expect(extended.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      })
    );
    expect(extended.passwordResetToken.delete).toHaveBeenCalledWith({ where: { token: "valid-tok" } });
  });
});
