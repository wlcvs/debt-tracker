import { notFound } from "next/navigation";
import { getPersonById } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { EditablePersonHeader } from "@/components/editable-person-header";
import { ShareButton } from "@/components/share-button";
import { PersonActions } from "@/components/person-actions";
import { DebtsSection } from "@/components/debts-section";
import { PaymentsSection } from "@/components/payments-section";

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
        <DebtsSection personId={person.id} debts={person.debts} creditCards={creditCards} />
        <PaymentsSection personId={person.id} payments={person.payments} />
      </div>
    </div>
  );
}
