import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { EditableDebt } from "@/components/editable-debt";
import { EditablePayment } from "@/components/editable-payment";
import { EditablePersonHeader } from "@/components/editable-person-header";
import { ShareButton } from "@/components/share-button";
import { PersonActions } from "@/components/person-actions";
import { CreateDebtForm } from "@/components/create-debt-form";
import { CreatePaymentForm } from "@/components/create-payment-form";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, creditCards] = await Promise.all([
    getPersonById(id),
    getCreditCards(),
  ]);

  if (!person) notFound();

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-16">
      {/* Person header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 flex flex-col gap-3">
        <EditablePersonHeader person={person} />
        <div className="flex items-center gap-3">
          <ShareButton personId={person.id} />
          <PersonActions person={person} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Debts */}
        <section className="flex flex-col gap-4">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Dívidas
          </p>

          {person.debts.length > 0 && (
            <ul className="flex flex-col">
              {person.debts.map((debt) => (
                <EditableDebt key={debt.id} debt={debt} />
              ))}
            </ul>
          )}

          <CreateDebtForm personId={person.id} creditCards={creditCards} />
        </section>

        {/* Payments */}
        <section className="flex flex-col gap-4">
          <p className="text-xs tracking-[0.25em] uppercase text-zinc-400 dark:text-zinc-500">
            Pagamentos
          </p>

          {person.payments.length > 0 && (
            <ul className="flex flex-col">
              {person.payments.map((payment) => (
                <EditablePayment key={payment.id} payment={payment} />
              ))}
            </ul>
          )}

          <CreatePaymentForm personId={person.id} />
        </section>
      </div>
    </div>
  );
}
