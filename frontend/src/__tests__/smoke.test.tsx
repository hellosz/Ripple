import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

function Greet() {
  return <button aria-label="greet">Hello</button>;
}

describe("test infrastructure smoke", () => {
  it("renders with React Testing Library + jest-dom", () => {
    render(<Greet />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "greet" })).toBeInTheDocument();
  });
});
