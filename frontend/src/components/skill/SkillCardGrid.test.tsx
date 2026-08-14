import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  skills: {
    list: vi.fn().mockResolvedValue({
      items: [],
      total: 4,
      page: 1,
      page_size: 12,
    }),
  },
}));

import { SkillCardGrid } from "./SkillCardGrid";

describe("SkillCardGrid filter bar", () => {
  it("renders the skill count with a semantic label", async () => {
    render(<SkillCardGrid />);
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("skills")).toBeInTheDocument();
  });

  it("renders the more-filters button", () => {
    render(<SkillCardGrid />);
    expect(
      screen.getByRole("button", { name: "More filters" })
    ).toBeInTheDocument();
  });
});
