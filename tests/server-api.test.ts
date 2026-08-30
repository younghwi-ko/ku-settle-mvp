import { describe, expect, it } from "vitest";
import { validImage, uuid } from "../app/lib/server-api";

describe("anonymous server input validation", () => {
  it("accepts only bounded image data URLs", () => {
    expect(validImage("data:image/png;base64,AAAA")).toBe(true);
    expect(validImage("https://example.com/image.png")).toBe(false);
    expect(validImage("data:text/html;base64,AAAA")).toBe(false);
  });
  it("validates UUID route identifiers", () => {
    expect(uuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(uuid("not-an-id")).toBe(false);
  });
});
