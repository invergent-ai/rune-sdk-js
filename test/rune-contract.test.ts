import { describe, expect, it } from "vitest";
import { choice, RateLimitError, RuneClient } from "../src";
import { json, mockFetch } from "./helpers";

describe("Rune API contract", () => {
  it.each(["text", "image", "thinking"])("supports %s decisions", async (mode) => {
    const onepass = {
      type: "choice",
      choice: "no",
      confidence: 0.1,
      probabilities: { yes: 0.45, no: 0.55 },
    };
    const wire = {
      id: "dec-test",
      model: "rune-v3",
      provider: "test",
      answers: {
        q: {
          type: "choice",
          choice: "yes",
          confidence: 0.8,
          probabilities: { yes: 0.9, no: 0.1 },
          ...(mode === "thinking" ? { thinking: { tokens: 7, closed: true, onepass } } : {}),
        },
      },
      usage: {
        input_tokens: 10,
        output_tokens: 1,
        cost: 0,
        reasoning_tokens: mode === "thinking" ? 7 : 0,
      },
    };
    const { fetch, requests } = mockFetch(() => json(wire));
    const images = ["data:image/png;base64,aW1hZ2U=", { url: "data:image/png;base64,dHdv" }];
    const request = {
      state: { value: "test" },
      questions: { q: choice("A test?", { yes: null, no: null }) },
      ...(mode === "image" ? { images } : {}),
      ...(mode === "thinking" ? { thinking: true } : {}),
    };
    const before = JSON.stringify(request);
    const result = await new RuneClient({ apiKey: "test-key", fetch }).decide(request);
    expect(requests[0]?.url).toBe("https://rune.surogate.ai/v1/decisions");
    expect(requests[0]?.body).toEqual({
      state: { value: "test" },
      model: "rune-v3",
      questions: {
        q: { type: "choice", instructions: "A test?", criteria: { yes: "yes", no: "no" } },
      },
      ...(mode === "image" ? { images } : {}),
      ...(mode === "thinking" ? { thinking: true } : {}),
    });
    expect(JSON.stringify(request)).toBe(before);
    expect(result).toEqual(wire);
    if (mode === "thinking") {
      expect(result.answers.q.thinking?.onepass.choice).toBe("no");
      expect(result.usage.reasoning_tokens).toBe(7);
    }
  });

  it("exposes the Rune rate-limit error and retry delay", async () => {
    const { fetch } = mockFetch(() =>
      json(
        {
          error: {
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
            message: "Try again later",
          },
        },
        { status: 429, headers: { "Retry-After": "1" } },
      ),
    );
    const client = new RuneClient({ apiKey: "test-key", fetch, retry: { maxRetries: 0 } });
    const error = await client.models.list().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterMs).toBe(1000);
    expect((error as RateLimitError).message).toContain("Try again later");
  });
});
