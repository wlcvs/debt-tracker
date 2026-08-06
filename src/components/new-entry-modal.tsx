"use client";

import { useState } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { ModalShell } from "@/components/modal-shell";
import { PersonSelect } from "@/components/person-select";
import { DebtForm } from "@/components/debt-form";
import { PaymentForm } from "@/components/payment-form";

interface PersonOption {
  accessCode: string;
  name: string;
}

interface Props {
  people: PersonOption[];
  creditCards: { id: string; label: string }[];
  onClose: () => void;
}

type EntryType = "debt" | "payment";

const toggleItemClass =
  "flex-1 border px-3 py-1.5 text-xs tracking-widest uppercase transition-colors cursor-pointer border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 data-[state=on]:border-zinc-900 dark:data-[state=on]:border-white data-[state=on]:text-zinc-900 dark:data-[state=on]:text-white";

/**
 * Logs a debt or a payment for any debtor without leaving the dashboard.
 *
 * It stays open after saving, keeping the chosen debtor and date, because the whole
 * point is entering a run of items — often for different people — that previously
 * meant a round trip through /person/[code] for each one.
 *
 * PersonSelect is a Radix Popover inside this Radix Dialog, which works because the
 * popover portals later and DismissableLayer only arms Escape for the topmost layer:
 * the first Escape closes the popover, not the modal. That would NOT hold for an
 * inline version of this — useDismiss compares against composedPath(), and the
 * portalled popover sits outside the wrapper, so picking an option would read as an
 * outside click and reset the form.
 */
export function NewEntryModal({ people, creditCards, onClose }: Props) {
  const [localPeople, setLocalPeople] = useState(people);
  const [personAccessCode, setPersonAccessCode] = useState("");
  const [type, setType] = useState<EntryType>("debt");
  const [savedMessage, setSavedMessage] = useState("");

  return (
    <ModalShell eyebrow="Novo lançamento" onClose={onClose} maxWidthClassName="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-zinc-400 mb-1">Devedor</p>
          <PersonSelect
            people={localPeople}
            value={personAccessCode}
            onChange={(next) => {
              setPersonAccessCode(next);
              setSavedMessage("");
            }}
            onPersonCreated={(person) =>
              setLocalPeople((prev) => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)))
            }
            placeholder="— Selecione —"
            size="md"
          />
        </div>

        <ToggleGroup.Root
          type="single"
          value={type}
          onValueChange={(v) => {
            // Radix emits "" when the pressed item is toggled off; ignoring that
            // keeps exactly one type selected, as with the installment direction.
            if (!v) return;
            setType(v as EntryType);
            setSavedMessage("");
          }}
          aria-label="Tipo de lançamento"
          className="flex gap-2"
        >
          <ToggleGroup.Item value="debt" className={toggleItemClass}>
            Dívida
          </ToggleGroup.Item>
          <ToggleGroup.Item value="payment" className={toggleItemClass}>
            Pagamento
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        {savedMessage && (
          <p className="text-xs tracking-wide text-zinc-400 dark:text-zinc-500">{savedMessage}</p>
        )}

        {/* Keyed by type so switching tabs starts the other form clean rather than
            carrying over a half-filled one. */}
        {type === "debt" ? (
          <DebtForm
            key="debt"
            personAccessCode={personAccessCode}
            creditCards={creditCards}
            onSaved={() => setSavedMessage("Dívida salva.")}
            onCancel={onClose}
            onSubmitStart={() => setSavedMessage("")}
          />
        ) : (
          <PaymentForm
            key="payment"
            personAccessCode={personAccessCode}
            onSaved={() => setSavedMessage("Pagamento salvo.")}
            onCancel={onClose}
            onSubmitStart={() => setSavedMessage("")}
          />
        )}
      </div>
    </ModalShell>
  );
}
