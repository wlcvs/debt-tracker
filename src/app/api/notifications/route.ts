import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPaymentNotification, sendDebtNotification } from "@/lib/email-notifications";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payment-methods";

// Timing-safe comparison via SHA-256 digests to avoid length/character leakage.
function isAuthorized(req: NextRequest) {
  const secret = process.env.NOTIFICATIONS_SECRET;
  if (!secret) return false;
  const incoming = req.headers.get("x-notifications-secret") ?? "";
  try {
    const a = createHash("sha256").update(incoming).digest();
    const b = createHash("sha256").update(secret).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// POST /api/notifications
// Body: { type: "payment" | "debt", id: string }
// Fetches data from DB and sends the appropriate email.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.id) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  if (body.type === "payment") {
    const payment = await prisma.payment.findUnique({
      where: { id: body.id },
      include: {
        person: {
          include: { debts: true, payments: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const person = payment.person;
    if (!person.email || !person.emailNotifications) {
      return NextResponse.json({ skipped: true, reason: "No email or notifications disabled" });
    }

    const totalOwed = person.debts.reduce((s, d) => s + Number(d.amount), 0);
    const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, totalOwed - totalPaid);

    await sendPaymentNotification({
      personName: person.name,
      personEmail: person.email,
      accessCode: person.accessCode,
      paymentAmount: Number(payment.amount),
      paymentMethod: PAYMENT_METHODS[payment.method as PaymentMethodKey] ?? payment.method,
      totalPaid,
      totalOwed,
      remaining,
    });

    return NextResponse.json({ sent: true });
  }

  if (body.type === "debt") {
    const debt = await prisma.debt.findUnique({
      where: { id: body.id },
      include: {
        person: {
          include: { debts: true, payments: true },
        },
      },
    });

    if (!debt) {
      return NextResponse.json({ error: "Debt not found" }, { status: 404 });
    }

    const person = debt.person;
    if (!person.email || !person.emailNotifications) {
      return NextResponse.json({ skipped: true, reason: "No email or notifications disabled" });
    }

    const totalPaid = person.payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalOwed = person.debts.reduce((s, d) => s + Number(d.amount), 0);
    const newBalance = Math.max(0, totalOwed - totalPaid);

    await sendDebtNotification({
      personName: person.name,
      personEmail: person.email,
      accessCode: person.accessCode,
      debtAmount: Number(debt.amount),
      debtDescription: debt.description,
      debtDate: debt.date,
      newBalance,
    });

    return NextResponse.json({ sent: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

// GET /api/notifications/pending
// Lists people who have email configured — useful for external services
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const people = await prisma.person.findMany({
    where: { email: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      accessCode: true,
      _count: { select: { debts: true, payments: true } },
    },
  });

  return NextResponse.json({ people });
}
