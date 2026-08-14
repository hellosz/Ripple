import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Header } from "./Header";
import { AuthContext } from "@/lib/auth";

function renderHeader(user: any = null) {
  return render(
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
        requireAuth: vi.fn(),
      }}
    >
      <Header />
    </AuthContext.Provider>
  );
}

describe("Header", () => {
  it("renders upload button with accessible label", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: "Upload Skill" })
    ).toBeInTheDocument();
  });

  it("renders login button for guests", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  it("renders user nickname when authenticated", () => {
    renderHeader({
      nickname: "ByteWalker",
      email: "b@example.com",
      role: "user",
    });
    expect(screen.getByText("ByteWalker")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Login" })
    ).not.toBeInTheDocument();
  });
});
