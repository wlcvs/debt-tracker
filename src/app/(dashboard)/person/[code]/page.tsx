import { notFound } from "next/navigation";
import { getPersonByAccessCode } from "@/lib/actions/person";
import { getCreditCards } from "@/lib/actions/credit-card";
import { PersonDetailView } from "@/components/person-detail-view";

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
    <div className="pb-16">
      {/* The header lives inside PersonDetailView rather than here: its balance
          summary follows the month selected in that component's carousel. */}
      <PersonDetailView person={person} creditCards={creditCards} />
    </div>
  );
}
