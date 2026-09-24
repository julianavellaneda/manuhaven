import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// React 19's `act` requires this flag in non-RTL environments.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// next-intl's locale-aware router. We only assert what the component hands it.
const replaceMock = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/welcome",
  useRouter: () => ({ replace: replaceMock }),
}));

// The current query string. `useSearchParams` (from next/navigation, NOT the
// i18n wrapper) is what the fix added so the query survives a locale switch.
let currentQuery = "t=TOKEN123";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";

let container: HTMLDivElement;
let root: Root;

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<LanguageSwitcher />);
  });
}

function clickLocale(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === label
  );
  if (!button) throw new Error(`No "${label}" button rendered`);
  act(() => {
    button.click();
  });
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    currentQuery = "t=TOKEN123";
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("preserves the current query string when switching locale (so /welcome?t=… keeps its token)", () => {
    render();
    clickLocale("ES");
    // Regression: the buggy version called router.replace(pathname, {locale}),
    // dropping ?t=… and 404-ing the target page. The fix passes an object with
    // an explicit query, which next-intl re-appends to the target URL.
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      { pathname: "/welcome", query: { t: "TOKEN123" } },
      { locale: "es" }
    );
  });

  it("passes an empty query object when there are no params (object call shape, not a bare path)", () => {
    currentQuery = "";
    render();
    clickLocale("ES");
    expect(replaceMock).toHaveBeenCalledWith(
      { pathname: "/welcome", query: {} },
      { locale: "es" }
    );
  });
});
