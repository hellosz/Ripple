import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SearchBar } from "./SearchBar";

describe("SearchBar", () => {
  it("renders an input with the given placeholder", () => {
    render(
      <SearchBar value="" onChange={vi.fn()} placeholder="Search skills..." />
    );
    expect(
      screen.getByPlaceholderText("Search skills...")
    ).toBeInTheDocument();
  });
});
