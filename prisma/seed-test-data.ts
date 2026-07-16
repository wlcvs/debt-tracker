import { prisma } from "@/lib/prisma";
import { splitInstallmentAmounts, installmentDate } from "@/lib/installments";

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
    data: { personId: carlos.id, creditCardId: nubank.id, amount: 350.0, title: "Jantar aniversário", date: new Date("2026-03-10") },
  });
  await prisma.debt.create({
    data: { personId: carlos.id, amount: 120.0, title: "Uber para o show", date: new Date("2026-04-02") },
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
    data: { personId: ana.id, creditCardId: inter.id, amount: 800.0, title: "Passagem aérea", date: new Date("2026-02-14") },
  });
  await prisma.debt.create({
    data: { personId: ana.id, amount: 250.0, title: "Mercado", date: new Date("2026-05-01") },
  });
  await prisma.payment.create({
    data: { personId: ana.id, amount: 400.0, method: "PIX", date: new Date("2026-03-01") },
  });

  // --- Rafael (sem pagamentos) ---
  const rafael = await prisma.person.create({
    data: { userId: user.id, name: "Rafael Mendes" },
  });

  const notebookGroupId = crypto.randomUUID();
  const notebookInstallments = splitInstallmentAmounts(1200.0, 3);
  const notebookBaseDate = new Date("2026-01-20");
  await prisma.debt.createMany({
    data: notebookInstallments.map((amount, i) => {
      const index = i + 1;
      return {
        personId: rafael.id,
        creditCardId: nubank.id,
        amount,
        title: `Notebook (${index}/3)`,
        date: installmentDate(notebookBaseDate, index, 3, "forward"),
        installmentGroupId: notebookGroupId,
        installmentIndex: index,
        installmentTotal: 3,
      };
    }),
  });
  await prisma.debt.create({
    data: { personId: rafael.id, amount: 90.0, title: "Farmácia", date: new Date("2026-05-18") },
  });
  await prisma.debt.create({
    data: { personId: rafael.id, amount: 55.5, title: "Almoço rodízio", date: new Date("2026-06-10") },
  });

  // --- Juliana (pagamento parcial) ---
  const juliana = await prisma.person.create({
    data: { userId: user.id, name: "Juliana Costa" },
  });

  await prisma.debt.create({
    data: { personId: juliana.id, amount: 180.0, title: "Ingresso festival", date: new Date("2026-04-20") },
  });
  await prisma.debt.create({
    data: { personId: juliana.id, creditCardId: inter.id, amount: 320.0, title: "Roupa loja online", date: new Date("2026-05-30") },
  });
  await prisma.debt.create({
    data: { personId: juliana.id, amount: 45.0, title: "Presente aniversário", paid: true, date: new Date("2026-03-05") },
  });
  await prisma.payment.create({
    data: { personId: juliana.id, amount: 200.0, method: "PIX", date: new Date("2026-06-01") },
  });

  // --- Bruno (dívidas marcadas pagas manualmente, sem nenhum Payment) ---
  const bruno = await prisma.person.create({
    data: { userId: user.id, name: "Bruno Ferreira" },
  });

  await prisma.debt.create({
    data: { personId: bruno.id, amount: 250.0, title: "Curso online", paid: true, date: new Date("2026-02-01") },
  });
  await prisma.debt.create({
    data: { personId: bruno.id, creditCardId: inter.id, amount: 430.0, title: "Peças de carro", paid: true, date: new Date("2026-03-15") },
  });
  await prisma.debt.create({
    data: { personId: bruno.id, amount: 95.0, title: "Jantar de negócios", date: new Date("2026-06-05") },
  });

  // --- Camila (compra parcelada retroativa, já totalmente quitada) ---
  const camila = await prisma.person.create({
    data: { userId: user.id, name: "Camila Rocha" },
  });

  const geladeiraGroupId = crypto.randomUUID();
  const geladeiraInstallments = splitInstallmentAmounts(600.0, 4);
  const geladeiraLastDate = new Date("2026-04-10");
  await prisma.debt.createMany({
    data: geladeiraInstallments.map((amount, i) => {
      const index = i + 1;
      return {
        personId: camila.id,
        creditCardId: nubank.id,
        amount,
        title: `Geladeira nova (${index}/4)`,
        date: installmentDate(geladeiraLastDate, index, 4, "backward"),
        paid: true,
        installmentGroupId: geladeiraGroupId,
        installmentIndex: index,
        installmentTotal: 4,
      };
    }),
  });
  await prisma.debt.create({
    data: { personId: camila.id, amount: 60.0, title: "Presente para o filho", date: new Date("2026-06-20") },
  });

  console.log("Dados de teste inseridos:");
  console.log(`  Carlos Souza   — id: ${carlos.id} (quitado via pagamentos)`);
  console.log(`  Ana Lima       — id: ${ana.id} (parcialmente pago)`);
  console.log(`  Rafael Mendes  — id: ${rafael.id} (sem pagamentos, com notebook parcelado)`);
  console.log(`  Juliana Costa  — id: ${juliana.id} (pagamento parcial + dívida já nascida paga)`);
  console.log(`  Bruno Ferreira — id: ${bruno.id} (dívidas marcadas pagas manualmente, sem Payment)`);
  console.log(`  Camila Rocha   — id: ${camila.id} (parcelamento retroativo já quitado)`);
  console.log("\nURL pública de exemplo:");
  console.log(`  /public/${carlos.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
