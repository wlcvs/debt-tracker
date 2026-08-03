import { notFound } from "next/navigation";
import { getPersonByAccessCode } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { EditablePersonHeader } from "@/components/editable-person-header";
import { ShareButton } from "@/components/share-button";
import { PersonVisibilityToggle } from "@/components/person-visibility-toggle";
import { PersonActions } from "@/components/person-actions";
import { PersonMonthView } from "@/components/person-month-view";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [person, creditCards] = await Promise.all([
    getPersonByAccessCode(code),
    getCreditCards(),
  ]);

  // See public/[code]/page.tsx for why this doesn't set a real HTTP 404
  // with loading.tsx present — same tradeoff, lower stakes here since this
  // route is admin-only (no untrusted caller distinguishes hidden-vs-missing
  // via status code the way the public route's visitors could).
  if (!person) notFound();

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-16">
      {/* Person header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 sm:pb-6 flex flex-col gap-3">
        <EditablePersonHeader person={person} />
        <div className="flex items-center gap-3">
          <ShareButton accessCode={person.accessCode} />
          <PersonVisibilityToggle accessCode={person.accessCode} publicVisible={person.publicVisible} />
          <PersonActions person={person} />
        </div>
      </div>

      <PersonMonthView accessCode={person.accessCode} debts={person.debts} payments={person.payments} creditCards={creditCards} />
    </div>
  );
}
