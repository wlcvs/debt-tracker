import { prisma } from "@/lib/prisma";

async function main() {
  const user = await prisma.user.findFirstOrThrow();

  const nubank = await prisma.creditCard.create({
    data: { userId: user.id, label: "Nubank" },
  });
  const inter = await prisma.creditCard.create({
    data: { userId: user.id, label: "Inter" },
  });

  // --- Carlos (quitado) ---
  const carlos = await prisma.person.create({
    data: { userId: user.id, name: "Carlos Souza" },
  });

  await prisma.debt.create({
    data: { personId: carlos.id, creditCardId: nubank.id, amount: 350.0, description: "Jantar aniversário", date: new Date("2026-03-10") },
  });
  await prisma.debt.create({
    data: { personId: carlos.id, amount: 120.0, description: "Uber para o show", date: new Date("2026-04-02") },
  });
  await prisma.payment.create({
    data: { personId: carlos.id, amount: 350.0, method: "PIX", date: new Date("2026-03-20") },
  });
  await prisma.payment.create({
    data: { personId: carlos.id, amount: 120.0, method: "CASH", date: new Date("2026-04-15") },
  });

  // --- Ana (parcialmente paga) ---
  const ana = await prisma.person.create({
    data: { userId: user.id, name: "Ana Lima" },
  });

  await prisma.debt.create({
    data: { personId: ana.id, creditCardId: inter.id, amount: 800.0, description: "Passagem aérea", date: new Date("2026-02-14") },
  });
  await prisma.debt.create({
    data: { personId: ana.id, amount: 250.0, description: "Mercado", date: new Date("2026-05-01") },
  });
  await prisma.payment.create({
    data: { personId: ana.id, amount: 400.0, method: "PIX", date: new Date("2026-03-01") },
  });

  // --- Rafael (sem pagamentos) ---
  const rafael = await prisma.person.create({
    data: { userId: user.id, name: "Rafael Mendes" },
  });

  await prisma.debt.create({
    data: { personId: rafael.id, creditCardId: nubank.id, amount: 1200.0, description: "Notebook", date: new Date("2026-01-20") },
  });
  await prisma.debt.create({
    data: { personId: rafael.id, amount: 90.0, description: "Farmácia", date: new Date("2026-05-18") },
  });
  await prisma.debt.create({
    data: { personId: rafael.id, amount: 55.5, description: "Almoço rodízio", date: new Date("2026-06-10") },
  });

  // --- Juliana (pagamento parcial) ---
  const juliana = await prisma.person.create({
    data: { userId: user.id, name: "Juliana Costa" },
  });

  await prisma.debt.create({
    data: { personId: juliana.id, amount: 180.0, description: "Ingresso festival", date: new Date("2026-04-20") },
  });
  await prisma.debt.create({
    data: { personId: juliana.id, creditCardId: inter.id, amount: 320.0, description: "Roupa loja online", date: new Date("2026-05-30") },
  });
  await prisma.payment.create({
    data: { personId: juliana.id, amount: 200.0, method: "PIX", date: new Date("2026-06-01") },
  });

  console.log("Dados de teste inseridos:");
  console.log(`  Carlos Souza  — id: ${carlos.id} (quitado)`);
  console.log(`  Ana Lima      — id: ${ana.id} (parcialmente pago)`);
  console.log(`  Rafael Mendes — id: ${rafael.id} (sem pagamentos)`);
  console.log(`  Juliana Costa — id: ${juliana.id} (pagamento parcial)`);
  console.log("\nURL pública de exemplo:");
  console.log(`  /public/${carlos.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
