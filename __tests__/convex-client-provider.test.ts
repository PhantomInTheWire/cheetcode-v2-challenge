import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

const convexClientCtor = vi.fn();
const convexProviderSpy = vi.fn();

vi.mock("convex/react", () => ({
  ConvexReactClient: class {
    constructor(url: string) {
      convexClientCtor(url);
    }
  },
  ConvexProvider: ({ children, ...props }: { children: ReactNode }) => {
    convexProviderSpy(props);
    return createElement("div", { "data-testid": "convex-provider" }, children);
  },
}));

describe("ConvexClientProvider", () => {
  it("builds client from env and renders provider with children", async () => {
    const { ConvexClientProvider } = await import("../src/components/ConvexClientProvider");
    const html = renderToStaticMarkup(
      createElement(ConvexClientProvider, {}, createElement("span", {}, "content")),
    );

    expect(convexClientCtor).toHaveBeenCalledWith("https://example.convex.cloud");
    expect(convexProviderSpy).toHaveBeenCalledTimes(1);
    expect(html).toContain("data-testid=\"convex-provider\"");
    expect(html).toContain("content");
  });
});
