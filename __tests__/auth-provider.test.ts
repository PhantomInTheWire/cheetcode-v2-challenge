import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const sessionProviderSpy = vi.fn();

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children, ...props }: { children: ReactNode }) => {
    sessionProviderSpy(props);
    return createElement("div", { "data-testid": "session-provider" }, children);
  },
}));

import { AuthProvider } from "../src/components/AuthProvider";

describe("AuthProvider", () => {
  it("renders children and forwards stable session polling config", () => {
    const html = renderToStaticMarkup(
      createElement(AuthProvider, {}, createElement("span", {}, "child")),
    );

    expect(html).toContain('data-testid="session-provider"');
    expect(html).toContain("child");
    expect(sessionProviderSpy).toHaveBeenCalledWith({
      refetchOnWindowFocus: false,
      refetchInterval: 0,
      refetchWhenOffline: false,
    });
  });
});
