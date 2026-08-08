import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceSummary } from "./balance-summary";

// A flat two-column grid: each label is immediately followed by its own value,
// with no per-row wrapper element.
function amountFor(label: string): HTMLElement {
  const value = screen.getByText(label).nextElementSibling;
  if (!value) throw new Error(`No amount found next to ${label}`);
  return value as HTMLElement;
}

function sizeClassOf(el: HTMLElement): string | undefined {
  return Array.from(el.classList).find((c) => /^text-(xs|sm|base|lg|xl|\dxl)$/.test(c));
}

describe("BalanceSummary", () => {
  // Every cell runs at the debtor name's size, labels included — a label at
  // text-[10px] disappeared beside its own number.
  it("renders labels and amounts at one size", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    for (const label of ["Valor devido", "Valor pago"]) {
      expect(sizeClassOf(screen.getByText(label))).toBe("text-lg");
      expect(sizeClassOf(amountFor(label))).toBe("text-lg");
    }
  });

  // Pure white against zinc-400 on a near-black background reads as a heavier,
  // larger figure even at an identical font size — which is what the size fix
  // was supposed to remove. The label is the only thing separating them now.
  it("renders both amounts in the same color", () => {
    render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    const owed = amountFor("Valor devido");
    const paid = amountFor("Valor pago");
    expect(paid.className).toBe(owed.className);
    expect(owed).toHaveClass("text-zinc-900");
  });

  // The old layout right-aligned each row on its own, so unequal widths pushed
  // the labels out of line. The grid has to hold them in two columns.
  it("keeps labels and amounts in two columns when the values differ in width", () => {
    const { container } = render(<BalanceSummary totalOwed={1234.5} totalPaid={20} />);

    const grid = container.firstElementChild!;
    expect(grid).toHaveClass("grid");
    // Four flat children — label, value, label, value — is what makes the
    // columns line up; a per-row wrapper would break it back into two
    // independent rows.
    expect(grid.children).toHaveLength(4);
    expect(Array.from(grid.children).map((c) => c.textContent)).toEqual([
      "Valor devido",
      "R$ 1.234,50",
      "Valor pago",
      "R$ 20,00",
    ]);
    expect(amountFor("Valor devido")).toHaveClass("text-right");
    expect(amountFor("Valor pago")).toHaveClass("text-right");
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
