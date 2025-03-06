import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import Tag from "@/components/tag";

describe("Tag Component", () => {
  it("renders tag with correct text content", () => {
    renderWithProviders(<Tag>Test Tag</Tag>);
    const tagElement = screen.getByText("Test Tag");
    expect(tagElement).toBeInTheDocument();
  });

  it("applies correct data attributes based on props", () => {
    renderWithProviders(
      <Tag variant="success" size="large" active={true}>
        Success Tag
      </Tag>,
    );
    const tagElement = screen.getByText("Success Tag");

    expect(tagElement).toHaveAttribute("data-variant", "success");
    expect(tagElement).toHaveAttribute("data-size", "large");
    expect(tagElement).toHaveAttribute("data-active", "true");
  });

  it("renders with default values when no props are provided", () => {
    renderWithProviders(<Tag>Default Tag</Tag>);
    const tagElement = screen.getByText("Default Tag");

    expect(tagElement).toHaveAttribute("data-size", "normal");
    expect(tagElement).not.toHaveAttribute("data-active", "true");
  });
});
