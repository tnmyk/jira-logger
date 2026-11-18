import { describe, expect, it } from "vitest";
import { adfToText, textToAdf } from "../src/lib/jira/adf";

describe("ADF comments", () => {
  it("builds a paragraph document", () => {
    expect(textToAdf("Fixed auth flow")).toEqual({
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Fixed auth flow" }],
        },
      ],
    });
  });

  it("returns undefined for empty comments", () => {
    expect(textToAdf("   ")).toBeUndefined();
  });

  it("reads text back", () => {
    expect(
      adfToText({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      }),
    ).toBe("Hello world");
  });
});
