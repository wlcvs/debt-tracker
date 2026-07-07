import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const stmt = await prisma.statement.findFirst({
    where: { id, userId: session.user.id },
    select: { pdfData: true, filename: true },
  });

  if (!stmt) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(stmt.pdfData), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${stmt.filename}"`,
    },
  });
}
