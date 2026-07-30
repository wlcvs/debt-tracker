import { prisma } from "@/lib/prisma";

export default async function globalCleanup() {
  await prisma.creditCard.deleteMany({ where: { label: { startsWith: "E2E " } } });
  await prisma.person.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await prisma.$disconnect();
}
