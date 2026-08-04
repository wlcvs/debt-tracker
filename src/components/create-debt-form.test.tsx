import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateDebtForm } from "./create-debt-form";
import { LocaleProvider } from "./locale-provider";

const createDebt = vi.fn();
vi.mock("@/lib/actions/debt", () => ({ createDebt: (fd: FormData) => createDebt(fd) }));

beforeEach(() => {
  createDebt.mockReset();
  createDebt.mockResolvedValue(undefined);
});

async function openInstallmentPanel() {
  render(
    <LocaleProvider>
      <CreateDebtForm accessCode="CODE1" creditCards={[]} />
    </LocaleProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /adicionar dívida/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /parcelar/i }));
  return screen.getByRole("textbox", { name: "Número de parcelas" });
}

// The old field clamped on every keystroke against a numeric state, so with 21
// on screen one more digit made "219", snapped to 60, and swallowed everything
// typed afterwards. It also could not be emptied: "" and "0" both reset to 2.
describe("CreateDebtForm — installment count", () => {
  it("does not jump to the max when a digit is typed after a two-digit value", async () => {
    const field = await openInstallmentPanel();

    await userEvent.clear(field);
    await userEvent.type(field, "21");
    expect(field).toHaveValue("21");

    await userEvent.type(field, "9");
    expect(field).not.toHaveValue("60");
    expect(field).toHaveValue("219");
  });

  it("can be emptied and retyped", async () => {
    const field = await openInstallmentPanel();

    await userEvent.clear(field);
    expect(field).toHaveValue("");

    await userEvent.type(field, "12");
    expect(field).toHaveValue("12");
  });

  it("ignores non-digits", async () => {
    const field = await openInstallmentPanel();

    await userEvent.clear(field);
    await userEvent.type(field, "1a2-,");
    expect(field).toHaveValue("12");
  });

  it("normalizes out-of-range values on blur, not while typing", async () => {
    const field = await openInstallmentPanel();

    await userEvent.clear(field);
    await userEvent.type(field, "99");
    await userEvent.tab();
    expect(field).toHaveValue("60");

    await userEvent.clear(field);
    await userEvent.type(field, "0");
    await userEvent.tab();
    expect(field).toHaveValue("1");

    await userEvent.clear(field);
    await userEvent.tab();
    expect(field).toHaveValue("1");
  });

  it("previews a single installment when the count is 1", async () => {
    const field = await openInstallmentPanel();

    await userEvent.type(screen.getByPlaceholderText("VALOR TOTAL"), "685,91");
    await userEvent.type(screen.getByRole("spinbutton", { name: "dia, Data" }), "10032026");

    await userEvent.clear(field);
    await userEvent.type(field, "1");
    await userEvent.tab();

    const rows = screen.getAllByRole("checkbox", { name: /^\d+\/\d+ —/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName("1/1 — 10/03/2026");
    expect(screen.getByText("R$ 685,91")).toBeInTheDocument();
  });

  it("puts the leftover cent on the first installment in the preview", async () => {
    const field = await openInstallmentPanel();

    await userEvent.type(screen.getByPlaceholderText("VALOR TOTAL"), "685,91");
    await userEvent.type(screen.getByRole("spinbutton", { name: "dia, Data" }), "10032026");
    await userEvent.clear(field);
    await userEvent.type(field, "10");
    await userEvent.tab();

    const amounts = screen.getAllByText(/^R\$ \d/).map((el) => el.textContent);
    expect(amounts[0]).toBe("R$ 68,60");
    expect(amounts.slice(1)).toEqual(Array(9).fill("R$ 68,59"));
  });
});

describe("CreateDebtForm — submit", () => {
  it("shows an inline message instead of failing silently when the action rejects", async () => {
    createDebt.mockRejectedValue(new Error("boom"));
    render(
      <LocaleProvider>
        <CreateDebtForm accessCode="CODE1" creditCards={[]} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /adicionar dívida/i }));

    await userEvent.type(screen.getByPlaceholderText("TÍTULO"), "Cama");
    await userEvent.type(screen.getByPlaceholderText("VALOR"), "685,91");
    await userEvent.type(screen.getByRole("spinbutton", { name: "dia, Data" }), "10032026");
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Pix" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createDebt).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/não foi possível salvar/i)).toBeInTheDocument();
    // Still open, so the typed data isn't lost.
    expect(screen.getByPlaceholderText("TÍTULO")).toHaveValue("Cama");
  });
});
