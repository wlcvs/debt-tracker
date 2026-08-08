import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceSummary } from "./balance-summary";

// The two amounts sit directly on top of each other, so a size mismatch is
// visible on both the person header and the public page. "Valor pago" used to
// be hardcoded to text-sm against a text-lg/text-xl "Valor devido".
function amountFor(label: string): HTMLElement {
  const row = screen.getByText(label).parentElement;
  if (!row) throw new Error(`No row found for ${label}`);
  const amount = row.querySelector("span:last-child");
  if (!amount) throw new Error(`No amount found for ${label}`);
  return amount as HTMLElement;
}

function sizeClassOf(el: HTMLElement): string | undefined {
  return Array.from(el.classList).find((c) => c.startsWith("text-"));
}

describe("BalanceSummary", () => {
  it("renders both amounts at the default size", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    expect(sizeClassOf(amountFor("Valor devido"))).toBe("text-lg");
    expect(sizeClassOf(amountFor("Valor pago"))).toBe("text-lg");
  });

  it("applies the size prop to both amounts, not just the owed one", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} size="text-xl" />);

    expect(sizeClassOf(amountFor("Valor devido"))).toBe("text-xl");
    expect(sizeClassOf(amountFor("Valor pago"))).toBe("text-xl");
  });

  it("keeps the paid amount dimmer — that, not the size, marks devido as primary", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    expect(amountFor("Valor devido")).toHaveClass("text-zinc-900");
    expect(amountFor("Valor pago")).toHaveClass("text-zinc-500");
  });

  it("formats both values in pt-BR", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    expect(amountFor("Valor devido")).toHaveTextContent("R$ 1.234,50");
    expect(amountFor("Valor pago")).toHaveTextContent("R$ 20,00");
  });

  // Both rows always render: the labels make R$ 0,00 read as a settled
  // balance rather than missing data.
  it("renders both rows when everything is zero", () => {
    render(<BalanceSummary totalOwed={0} totalPaid={0} />);

    expect(amountFor("Valor devido")).toHaveTextContent("R$ 0,00");
    expect(amountFor("Valor pago")).toHaveTextContent("R$ 0,00");
  });
});
