import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/skill/SkillCardGrid", () => ({
  SkillCardGrid: () => <div data-testid="grid" />,
}));
vi.mock("@/components/layout/RippleQuote", () => ({
  RippleQuote: () => <div data-testid="quote" />,
}));

import HomePage from "@/app/page";

describe("HomePage hero heading", () => {
  it("renders the brand heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "One Drop, Endless Ripples."
    );
  });

  it("emphasizes Ripples with the brand color", () => {
    render(<HomePage />);
    expect(screen.getByText("Ripples.")).toHaveClass("text-ripple-400");
  });
});
