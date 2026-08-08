// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CapabilityLease,
  useCapabilityLease,
  useDebouncedValue,
  useDemoIntent,
} from "./demoLifecycle.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("useCapabilityLease", () => {
  const makeLease = () => {
    const release = vi.fn();
    const create = vi.fn(
      (): CapabilityLease => ({ ready: Promise.resolve(), release }),
    );
    return { create, release };
  };

  const LeaseProbe = ({
    intent,
    create,
  }: {
    intent: boolean;
    create: () => CapabilityLease;
  }) => {
    useCapabilityLease(intent, create);
    return null;
  };

  it("acquires only when intent is true and releases on unmount", () => {
    const { create, release } = makeLease();
    act(() => root?.render(<LeaseProbe intent={false} create={create} />));
    expect(create).not.toHaveBeenCalled();

    act(() => root?.render(<LeaseProbe intent={true} create={create} />));
    expect(create).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    act(() => root?.unmount());
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("recycles the lease when the factory identity changes", () => {
    const first = makeLease();
    const second = makeLease();
    act(() => root?.render(<LeaseProbe intent={true} create={first.create} />));
    act(() =>
      root?.render(<LeaseProbe intent={true} create={second.create} />),
    );
    expect(first.release).toHaveBeenCalledTimes(1);
    expect(second.create).toHaveBeenCalledTimes(1);
    expect(second.release).not.toHaveBeenCalled();
  });

  it("swallows ready rejections", async () => {
    const release = vi.fn();
    const create = (): CapabilityLease => ({
      ready: Promise.reject(new Error("unavailable")),
      release,
    });
    act(() => root?.render(<LeaseProbe intent={true} create={create} />));
    // Flush microtasks; an unhandled rejection would fail the test run.
    await act(async () => {});
    act(() => root?.unmount());
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("useDebouncedValue", () => {
  const Probe = ({ value }: { value: string }) => {
    const debounced = useDebouncedValue(value, 600);
    return <output>{debounced}</output>;
  };

  it("holds the previous value until the delay elapses", () => {
    vi.useFakeTimers();
    try {
      act(() => root?.render(<Probe value="first" />));
      act(() => vi.runAllTimers());
      expect(container.textContent).toBe("first");

      act(() => root?.render(<Probe value="second" />));
      expect(container.textContent).toBe("first");

      act(() => vi.advanceTimersByTime(599));
      expect(container.textContent).toBe("first");

      act(() => vi.advanceTimersByTime(1));
      expect(container.textContent).toBe("second");
    } finally {
      vi.useRealTimers();
    }
  });

  it("restarts the delay on every change", () => {
    vi.useFakeTimers();
    try {
      act(() => root?.render(<Probe value="a" />));
      act(() => vi.runAllTimers());
      act(() => root?.render(<Probe value="ab" />));
      act(() => vi.advanceTimersByTime(400));
      act(() => root?.render(<Probe value="abc" />));
      act(() => vi.advanceTimersByTime(400));
      expect(container.textContent).toBe("a");
      act(() => vi.advanceTimersByTime(200));
      expect(container.textContent).toBe("abc");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useDemoIntent", () => {
  const Probe = ({ external }: { external?: boolean }) => {
    const { intent, interacted, markInteracted } = useDemoIntent(external);
    return (
      <button type="button" onClick={markInteracted}>
        {intent ? "intent" : "no-intent"}:{interacted ? "touched" : "untouched"}
      </button>
    );
  };

  it("combines the external signal with direct interaction", () => {
    act(() => root?.render(<Probe />));
    expect(container.textContent).toBe("no-intent:untouched");

    act(() => root?.render(<Probe external />));
    expect(container.textContent).toBe("intent:untouched");

    act(() => container.querySelector("button")?.click());
    expect(container.textContent).toBe("intent:touched");
  });
});
