import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MethodSelect, type MethodOption } from "./method-select";

const options: MethodOption[] = [
  { value: "PIX", label: "Pix" },
  { value: "CASH", label: "Dinheiro" },
  { value: "card_1", label: "Nubank" },
];

function Harness({ onSubmit }: { onSubmit: (fd: FormData) => void }) {
  const [method, setMethod] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
        // Mimics a form that clears itself but stays mounted, the way
        // NewEntryModal does after each save.
        setMethod("");
      }}
    >
      <MethodSelect name="debtMethod" options={options} value={method} onChange={setMethod} />
      <button type="submit">Salvar</button>
    </form>
  );
}

// These lock the contract that made this component keep its own hidden input
// instead of using Select.Root's `name` prop. Radix's hidden native <select>
// only emits an empty option when the value is `undefined`; this component
// models "nothing chosen" as "", and a native select whose value matches no
// option silently selects its first one — which would turn an unset method
// into "PIX" in every server action that reads this field.
describe("MethodSelect form submission", () => {
  it("submits an empty string when no method is chosen", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].get("debtMethod")).toBe("");
  });

  it("submits the selected option's value, not its label", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Nubank" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit.mock.calls[0][0].get("debtMethod")).toBe("card_1");
  });

  // Select.Root used to receive `value || undefined`, which flips Radix to
  // uncontrolled the moment the caller clears the method. Radix then kept the
  // previous selection internally, so re-picking that same option was a no-op to
  // it, onValueChange never fired, and the caller stayed stuck on "" — with the
  // trigger showing the old label. Invisible until a form reset without unmounting.
  it("can be re-picked after the caller resets it to empty", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Pix" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onSubmit.mock.calls[0][0].get("debtMethod")).toBe("PIX");

    // The reset must actually show through to Radix.
    expect(screen.getByRole("combobox")).toHaveTextContent("— Método —");

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Pix" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onSubmit.mock.calls[1][0].get("debtMethod")).toBe("PIX");
  });

  it("exposes combobox/option roles the hand-rolled version never had", async () => {
    render(<Harness onSubmit={vi.fn()} />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Pix" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dinheiro" })).toBeInTheDocument();
  });
});
