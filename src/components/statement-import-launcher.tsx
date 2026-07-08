"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { StatementsModal } from "@/components/statements-modal";

// Loaded client-only: this drags in pdfjs-dist's browser worker asset
// reference, which Next's server compiler otherwise tries to analyze
// (and fails on) while server-rendering this component's initial "closed"
// state — see next.config.ts's serverExternalPackages comment.
const ImportModal = dynamic(() => import("@/components/import-modal").then((m) => m.ImportModal), {
  ssr: false,
});

interface Props {
  people: { id: string; name: string }[];
}

type ActiveModal = "none" | "statements" | "import";

export function StatementImportLauncher({ people }: Props) {
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [cameFromStatements, setCameFromStatements] = useState(false);

  return (
    <>
      <button
        onClick={() => setActiveModal("statements")}
        className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-[10px] tracking-widest uppercase text-zinc-400 dark:text-zinc-500 hover:border-zinc-500 dark:hover:border-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
      >
        Extratos
      </button>

      {activeModal === "statements" && (
        <StatementsModal
          onClose={() => setActiveModal("none")}
          onImportNew={() => {
            setReopenId(null);
            setCameFromStatements(true);
            setActiveModal("import");
          }}
          onReopen={(id) => {
            setReopenId(id);
            setCameFromStatements(true);
            setActiveModal("import");
          }}
        />
      )}

      {activeModal === "import" && (
        <ImportModal
          people={people}
          reopenStatementId={reopenId}
          cameFromStatements={cameFromStatements}
          onClose={() => setActiveModal("none")}
          onBackToStatements={() => setActiveModal("statements")}
        />
      )}
    </>
  );
}
