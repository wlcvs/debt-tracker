import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateField } from "./date-field";
import { LocaleProvider } from "./locale-provider";

function renderInApp(ui: React.ReactNode) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

// The whole point of this component: a native <input type="date"> renders in
// the browser's UI language, not the app's, so a browser set to English showed
// mm/dd/yyyy. These lock both halves of the fix — the pt-BR segment order, and
// the fact that the form still receives a plain YYYY-MM-DD string.
describe("DateField", () => {
  it("orders segments as dd/mm/aaaa regardless of the environment locale", () => {
    renderInApp(<DateField aria-label="Data" defaultValue="2026-03-10" />);

    const segments = screen.getAllByRole("spinbutton").map((s) => s.getAttribute("aria-label"));
    expect(segments).toEqual(["dia, Data", "mês, Data", "ano, Data"]);
  });

  it("submits the value as YYYY-MM-DD", async () => {
    const onSubmit = vi.fn();
    renderInApp(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <DateField name="date" aria-label="Data" defaultValue="2026-03-10" />
        <button type="submit">Salvar</button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].get("date")).toBe("2026-03-10");
  });

  it("reports a controlled change as YYYY-MM-DD", async () => {
    function Harness({ onChange }: { onChange: (v: string) => void }) {
      const [value, setValue] = useState("2026-03-10");
      return (
        <DateField
          aria-label="Data"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    const onChange = vi.fn();
    renderInApp(<Harness onChange={onChange} />);

    // Arrow-up on the day segment moves 10 -> 11.
    await userEvent.click(screen.getByRole("spinbutton", { name: "dia, Data" }));
    await userEvent.keyboard("{ArrowUp}");

    expect(onChange).toHaveBeenLastCalledWith("2026-03-11");
  });

  it("starts empty when given no value", () => {
    renderInApp(<DateField name="date" aria-label="Data" />);

    const day = screen.getByRole("spinbutton", { name: "dia, Data" });
    expect(day).toHaveAttribute("data-placeholder");
  });
});
