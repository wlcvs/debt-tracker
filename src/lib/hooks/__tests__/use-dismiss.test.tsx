import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { useDismiss, useDismissGuard, type UseDismissOptions } from "../use-dismiss";

function TestDismissable({
  onDismiss,
  options,
}: {
  onDismiss: () => void;
  options?: UseDismissOptions;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onDismiss, options);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        inside
      </div>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe("useDismiss", () => {
  it("fires onDismiss on outside click", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("outside"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not fire onDismiss on inside click", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("inside"));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("fires onDismiss on Escape", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Escape keys", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("skips the outside-click listener when outsideClick is false", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} options={{ outsideClick: false }} />);
    fireEvent.click(screen.getByTestId("outside"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("skips the Escape listener when escape is false", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} options={{ escape: false }} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("outside"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("detaches both listeners when enabled is false", () => {
    const onDismiss = vi.fn();
    render(<TestDismissable onDismiss={onDismiss} options={{ enabled: false }} />);
    fireEvent.click(screen.getByTestId("outside"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("always calls the latest onDismiss even without re-attaching listeners", () => {
    const onDismissA = vi.fn();
    const onDismissB = vi.fn();
    const { rerender } = render(<TestDismissable onDismiss={onDismissA} />);
    rerender(<TestDismissable onDismiss={onDismissB} />);
    fireEvent.click(screen.getByTestId("outside"));
    expect(onDismissA).not.toHaveBeenCalled();
    expect(onDismissB).toHaveBeenCalledTimes(1);
  });
});

describe("useDismissGuard", () => {
  it("runs the callback normally when nothing was suppressed", () => {
    const { result } = renderHook(() => useDismissGuard());
    const fn = vi.fn();
    act(() => result.current.guard(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("swallows exactly the next guard() call after suppressNext()", () => {
    const { result } = renderHook(() => useDismissGuard());
    const fn = vi.fn();

    act(() => result.current.suppressNext());
    act(() => result.current.guard(fn));
    expect(fn).not.toHaveBeenCalled();

    // the guard after the suppressed one behaves normally again
    act(() => result.current.guard(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("only suppresses one guard() call per suppressNext()", () => {
    const { result } = renderHook(() => useDismissGuard());
    const fn = vi.fn();

    act(() => result.current.suppressNext());
    act(() => result.current.guard(vi.fn())); // swallowed
    act(() => result.current.guard(fn)); // not swallowed
    act(() => result.current.guard(fn)); // not swallowed either

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
