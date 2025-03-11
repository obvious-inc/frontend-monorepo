import { describe, it, expect } from "vitest";
import { normalizeId, safelyDecodeURIComponent } from "./candidates";

describe("safelyDecodeURIComponent", () => {
  it("should handle regular strings", () => {
    const input = "hello world";
    expect(safelyDecodeURIComponent(input)).toBe(input);
  });

  it("should decode URL encoded strings", () => {
    const input = "hello%20world";
    expect(safelyDecodeURIComponent(input)).toBe("hello world");
  });

  it("should handle double-encoded strings", () => {
    const input = "hello%2520world"; // %25 is '%' encoded, so this is double-encoded "hello%20world"
    expect(safelyDecodeURIComponent(input)).toBe("hello world");
  });

  it("should handle triple-encoded strings", () => {
    const input = "hello%252520world"; // Triple-encoded "hello world"
    expect(safelyDecodeURIComponent(input)).toBe("hello world");
  });

  it("should handle partially encoded strings", () => {
    const input = "hello%20world%2520and%252520universe";
    expect(safelyDecodeURIComponent(input)).toBe("hello world and universe");
  });

  it("should handle invalid encoded sequences gracefully", () => {
    const input = "hello%2world"; // Invalid percent encoding
    expect(safelyDecodeURIComponent(input)).toBe("hello%2world");
  });
});

describe("normalizeId", () => {
  it("should normalize IDs with proposer address first", () => {
    const input = "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-some-slug";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-some-slug",
    );
  });

  it("should normalize IDs with proposer address last", () => {
    const input = "some-slug-0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-some-slug",
    );
  });

  it("should handle proposer address without 0x prefix", () => {
    const input = "e26067c76fdbe877f48b0a8400cf5db8b47af0fe-some-slug";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-some-slug",
    );
  });

  it("should normalize to lowercase", () => {
    const input = "0xE26067c76fdbe877F48b0a8400cf5Db8B47aF0fE-some-slug";
    const result = normalizeId(input);
    // Check that the result contains the lowercase address
    expect(result.includes("0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe")).toBe(
      true,
    );
    // Check that the result contains the slug
    expect(result.includes("some-slug")).toBe(true);
  });

  it("should handle URL encoded IDs", () => {
    const input =
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-%5Bdraft%5D-%2423k-usd-for-nft-folder-evolution-%E2%80%94-yea-or-nay";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-[draft]-$23k-usd-for-nft-folder-evolution-—-yea-or-nay",
    );
  });

  it("should handle double-encoded IDs", () => {
    const input =
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-%5Bdraft%5D-%252423k-usd-for-nft-folder-evolution-%25E2%2580%2594-yea-or-nay";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-[draft]-$23k-usd-for-nft-folder-evolution-—-yea-or-nay",
    );
  });

  it("should handle URL encoded IDs with proposer at the end", () => {
    const input =
      "%5Bdraft%5D-%2423k-usd-for-nft-folder-evolution-%E2%80%94-yea-or-nay-0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-[draft]-$23k-usd-for-nft-folder-evolution-—-yea-or-nay",
    );
  });

  it("should handle double-encoded IDs with proposer at the end", () => {
    const input =
      "%5Bdraft%5D-%252423k-usd-for-nft-folder-evolution-%25E2%2580%2594-yea-or-nay-0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe";
    expect(normalizeId(input)).toBe(
      "0xe26067c76fdbe877f48b0a8400cf5db8b47af0fe-[draft]-$23k-usd-for-nft-folder-evolution-—-yea-or-nay",
    );
  });
});
