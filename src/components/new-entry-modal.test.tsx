import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewEntryModal } from "./new-entry-modal";
import { LocaleProvider } from "./locale-provider";

const createDebt = vi.fn();
const createPayment = vi.fn();

vi.mock("@/lib/actions/debt", () => ({ createDebt: (fd: FormData) => createDebt(fd) }));
vi.mock("@/lib/actions/payment", () => ({ createPayment: (fd: FormData) => createPayment(fd) }));
// PersonSelect imports this for its inline "+ Novo devedor"; unused here, but the
// real module would drag Prisma into jsdom just by being imported.
vi.mock("@/lib/actions/person", () => ({ createPerson: vi.fn() }));

const PEOPLE = [
  { accessCode: "CODE1", name: "Ana" },
  { accessCode: "CODE2", name: "Bruno" },
];

beforeEach(() => {
  createDebt.mockReset();
  createDebt.mockResolvedValue(undefined);
  createPayment.mockReset();
  createPayment.mockResolvedValue(undefined);
});

function renderModal() {
  render(
    <LocaleProvider>
      <NewEntryModal people={PEOPLE} creditCards={[]} onClose={() => {}} />
    </LocaleProvider>,
  );
}

async function pickPerson(name: string) {
  // "Devedor" is the trigger's aria-label, so it stays findable once a person
  // is chosen — the visible text changes to that person's name.
  await userEvent.click(screen.getByRole("button", { name: "Devedor" }));
  await userEvent.click(screen.getByRole("button", { name, exact: true }));
}

async function pickMethod(label: string) {
  await userEvent.click(screen.getByRole("combobox"));
  await userEvent.click(screen.getByRole("option", { name: label }));
}

async function fillDebt({ title, amount }: { title: string; amount: string }) {
  await userEvent.type(screen.getByPlaceholderText("TÍTULO"), title);
  await userEvent.type(screen.getByPlaceholderText("VALOR"), amount);
  await userEvent.type(screen.getByRole("spinbutton", { name: "dia, Data" }), "10032026");
  await pickMethod("Pix");
}

// The debtor is a runtime choice here, unlike on the person page where it comes
// from the route — so it is the one field that can be missing at submit time.
describe("NewEntryModal — debtor is required", () => {
  it("refuses to save with nobody selected, and says so", async () => {
    renderModal();

    await fillDebt({ title: "Cama", amount: "685,91" });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createDebt).not.toHaveBeenCalled();
    expect(await screen.findByText("Selecione o devedor.")).toBeInTheDocument();
  });

  it("saves once a debtor is picked", async () => {
    renderModal();

    await pickPerson("Bruno");
    await fillDebt({ title: "Cama", amount: "685,91" });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createDebt).toHaveBeenCalledTimes(1);
    const fd = createDebt.mock.calls[0][0] as FormData;
    expect(fd.get("personAccessCode")).toBe("CODE2");
    expect(fd.get("title")).toBe("Cama");
    expect(fd.get("amount")).toBe("685,91");
    expect(fd.get("date")).toBe("2026-03-10");
  });
});

describe("NewEntryModal — type toggle", () => {
  it("swaps between the debt and payment forms", async () => {
    renderModal();

    expect(screen.getByPlaceholderText("TÍTULO")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Pagamento" }));

    // Only the debt form has a title or an installment option.
    expect(screen.queryByPlaceholderText("TÍTULO")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /parcelar/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("VALOR")).toBeInTheDocument();
  });

  it("routes the save to createPayment", async () => {
    renderModal();

    await pickPerson("Ana");
    await userEvent.click(screen.getByRole("radio", { name: "Pagamento" }));
    await userEvent.type(screen.getByPlaceholderText("VALOR"), "50,00");
    await userEvent.type(screen.getByRole("spinbutton", { name: "dia, Data" }), "10032026");
    await pickMethod("Pix");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createDebt).not.toHaveBeenCalled();
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect((createPayment.mock.calls[0][0] as FormData).get("personAccessCode")).toBe("CODE1");
  });
});

// The whole reason this modal exists: entering a run of items without reopening it.
describe("NewEntryModal — after saving", () => {
  it("stays open, keeps the debtor and date, and clears the rest", async () => {
    renderModal();

    await pickPerson("Bruno");
    await fillDebt({ title: "Cama", amount: "685,91" });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Dívida salva.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("TÍTULO")).toHaveValue("");
    expect(screen.getByPlaceholderText("VALOR")).toHaveValue("");

    // The second entry needs neither the debtor nor the date typed again.
    await userEvent.type(screen.getByPlaceholderText("TÍTULO"), "Mesa");
    await userEvent.type(screen.getByPlaceholderText("VALOR"), "120,00");
    await pickMethod("Pix");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(createDebt).toHaveBeenCalledTimes(2);
    const second = createDebt.mock.calls[1][0] as FormData;
    expect(second.get("personAccessCode")).toBe("CODE2");
    expect(second.get("date")).toBe("2026-03-10");
    expect(second.get("title")).toBe("Mesa");
  });

  it("drops the saved confirmation when the next attempt fails", async () => {
    renderModal();

    await pickPerson("Ana");
    await fillDebt({ title: "Cama", amount: "685,91" });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Dívida salva.")).toBeInTheDocument();

    createDebt.mockRejectedValue(new Error("boom"));
    await userEvent.type(screen.getByPlaceholderText("TÍTULO"), "Mesa");
    await userEvent.type(screen.getByPlaceholderText("VALOR"), "120,00");
    await pickMethod("Pix");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/não foi possível salvar/i)).toBeInTheDocument();
    expect(screen.queryByText("Dívida salva.")).not.toBeInTheDocument();
  });
});
